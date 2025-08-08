// my-chat-backend/server.js

require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io'); 
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); 
const jwt = require('jsonwebtoken'); 

const app = express();
const server = http.createServer(app);

app.use(express.json());

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000"; 

app.use(cors({
  origin: FRONTEND_URL,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"]
}));

const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"]
  }
});

app.get('/', (req, res) => {
  res.send('Auth server is running!');
});

// --- MongoDB Connection ---
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/auth_app_db';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('MongoDB connected successfully!'))
  .catch(err => console.error('MongoDB connection error:', err));

// --- MongoDB Schema and Model for Users ---
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  friends: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  pendingFriendRequests: [{
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
});

const User = mongoose.model('User', userSchema);

// --- MongoDB Schema and Model for Messages ---
const messageSchema = new mongoose.Schema({
  sender: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true }
  },
  receiver: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true }
  },
  content: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const Message = mongoose.model('Message', messageSchema);


// --- JWT Secret Key ---
// !!! นี่คือจุดสำคัญที่สุด !!!
// !!! ตรวจสอบให้แน่ใจว่าค่านี้ตรงกันเป๊ะกับในไฟล์ .env ของคุณ
// !!! หากคุณใช้ .env ให้ copy ค่าจาก .env มาวางตรงนี้โดยตรง
// !!! หากไม่มี .env ให้ใช้ค่านี้เป็นหลัก และตรวจสอบให้แน่ใจว่าคุณไม่ได้เปลี่ยนมันที่อื่น
const JWT_SECRET = process.env.JWT_SECRET || 'MY_SUPER_SECURE_KEY_FOR_CHAT_APP_2025'; 
console.log('Backend: JWT_SECRET being used:', JWT_SECRET); // Debug log เพื่อยืนยัน Secret ที่ใช้

// --- Middleware สำหรับยืนยันตัวตน (Authentication Middleware) ---
const verifyToken = (req, res, next) => {
  const authHeader = req.header('Authorization');
  console.log('Backend: verifyToken - Received Authorization Header:', authHeader); // Debug log 1

  if (!authHeader) {
    console.log('Backend: verifyToken - No Authorization header found.');
    return res.status(401).json({ message: 'ไม่พบ Token, ไม่ได้รับอนุญาต' });
  }

  const token = authHeader.replace('Bearer ', '');
  console.log('Backend: verifyToken - Extracted Token (first 30 chars):', token ? token.substring(0, 30) + '...' : 'No Token'); // Debug log 2

  if (!token) {
    console.log('Backend: verifyToken - Token is empty after "Bearer " removal.');
    return res.status(401).json({ message: 'รูปแบบ Token ไม่ถูกต้อง, ไม่ได้รับอนุญาต' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET); // ใช้ JWT_SECRET ที่ประกาศไว้
    req.user = decoded; 
    console.log('Backend: verifyToken - Token successfully decoded. User ID:', decoded.userId); // Debug log 3
    next();
  } catch (error) {
    console.error('Backend: Token verification failed:', error); // Debug log 4
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token หมดอายุ, กรุณาเข้าสู่ระบบอีกครั้ง' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Token ไม่ถูกต้อง, ไม่ได้รับอนุญาต (Invalid Token Signature)' });
    }
    res.status(401).json({ message: 'Token ไม่ถูกต้อง, ไม่ได้รับอนุญาต' });
  }
};

// --- Socket.IO: Map userId to socket.id ---
const userSockets = new Map();

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('register', (userId) => {
    if (userId) {
      if (!userSockets.has(userId)) {
        userSockets.set(userId, new Set());
      }
      userSockets.get(userId).add(socket.id);
      console.log(`User ${userId} registered with socket ${socket.id}. Total sockets for user: ${userSockets.get(userId).size}`);
      socket.join(userId); 
      console.log(`Socket ${socket.id} joined room ${userId}`);
    }
  });

  socket.on('sendMessage', async (data) => {
    const { senderId, receiverId, content } = data;
    console.log(`Received message from ${senderId} to ${receiverId}: ${content}`);

    try {
      const sender = await User.findById(senderId);
      const receiver = await User.findById(receiverId);

      if (!sender || !receiver) {
        console.error('Sender or Receiver not found for message:', senderId, receiverId);
        return;
      }

      const newMessage = new Message({
        sender: { id: sender._id, name: sender.name },
        receiver: { id: receiver._id, name: receiver.name },
        content: content,
      });
      await newMessage.save();

      const messagePayload = {
          sender: { id: sender._id.toString(), name: sender.name },
          receiver: { id: receiver._id.toString(), name: receiver.name },
          content: content,
          timestamp: newMessage.timestamp,
          _id: newMessage._id.toString()
      };

      io.to(senderId).emit('receiveMessage', messagePayload);
      if (senderId !== receiverId) {
          io.to(receiverId).emit('receiveMessage', messagePayload);
      }
      console.log('Message saved and emitted.');

    } catch (error) {
      console.error('Error saving or emitting message:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    for (let [userId, sockets] of userSockets.entries()) {
      if (sockets.has(socket.id)) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          userSockets.delete(userId);
        }
        console.log(`User ${userId} unregistered socket ${socket.id}. Remaining sockets for user: ${sockets.size}`);
        break;
      }
    }
  });
});

const emitToUser = (userId, eventName, data) => {
  const sockets = userSockets.get(userId);
  if (sockets) {
    sockets.forEach(socketId => {
      io.to(socketId).emit(eventName, data);
      console.log(`Emitted '${eventName}' to user ${userId} (socket: ${socketId})`);
    });
  } else {
    console.log(`No active sockets found for user ${userId} to emit '${eventName}'.`);
  }
};


// --- API Routes for Authentication ---

app.get('/api/check-email', async (req, res) => {
  const { email } = req.query;
  try {
    const user = await User.findOne({ email });
    res.json({ isEmailTaken: !!user }); 
  } catch (error) {
    console.error('Error checking email:', error);
    res.status(500).json({ message: 'Server error during email check.' });
  }
});

app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'อีเมลนี้ถูกใช้ไปแล้ว' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      name,
      email,
      password: hashedPassword,
    });
    await newUser.save();

    res.status(201).json({ message: 'สมัครสมาชิกสำเร็จ!' });

  } catch (error) {
    console.error('Error during registration:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการสมัครสมาชิก' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      JWT_SECRET, // ใช้ JWT_SECRET ที่ประกาศไว้ด้านบน
      { expiresIn: '1h' }
    );

    res.status(200).json({ message: 'เข้าสู่ระบบสำเร็จ!', token, user: { id: user._id, name: user.name, email: user.email } });

  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ' });
  }
});

app.put('/api/users/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { name, email, password } = req.body;

  if (req.user.userId !== id) {
    return res.status(403).json({ message: 'ไม่ได้รับอนุญาตให้แก้ไขโปรไฟล์นี้' });
  }

  try {
    const updateFields = {};

    if (name !== undefined) {
      updateFields.name = name;
    }

    if (email !== undefined) {
      const existingUserWithNewEmail = await User.findOne({ email });
      if (existingUserWithNewEmail && existingUserWithNewEmail._id.toString() !== id) {
        return res.status(400).json({ message: 'อีเมลนี้ถูกใช้โดยผู้ใช้คนอื่นแล้ว' });
      }
      updateFields.email = email;
    }

    if (password !== undefined && password !== '') {
      const salt = await bcrypt.genSalt(10);
      updateFields.password = await bcrypt.hash(password, salt);
    }

    const updatedUser = await User.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: 'ไม่พบผู้ใช้งาน' });
    }

    res.status(200).json({
      message: 'อัปเดตโปรไฟล์สำเร็จ!',
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
      },
    });

  } catch (error) {
    console.error('Error updating user profile:', error);
    if (error.code === 11000) {
        return res.status(400).json({ message: 'อีเมลนี้ถูกใช้ไปแล้ว' });
    }
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการอัปเดตโปรไฟล์' });
  }
});

app.get('/api/users/search', verifyToken, async (req, res) => {
  const { query } = req.query;

  if (!query) {
    return res.status(400).json({ message: 'กรุณาระบุคำค้นหา' });
  }

  try {
    const searchRegex = new RegExp(query, 'i');

    const users = await User.find({
      $or: [
        { name: { $regex: searchRegex } },
        { email: { $regex: searchRegex } }
      ]
    }).select('-password');

    const filteredUsers = users.filter(user => user._id.toString() !== req.user.userId);

    const formattedUsers = filteredUsers.map(user => ({
      id: user._id.toString(),
      name: user.name,
      email: user.email
    }));

    res.status(200).json({ users: formattedUsers });

  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการค้นหาผู้ใช้' });
  }
});

app.post('/api/friend-requests/send', verifyToken, async (req, res) => {
  const { receiverId } = req.body;
  const senderId = req.user.userId;

  if (!receiverId) {
    return res.status(400).json({ message: 'ไม่พบ ID ผู้รับ' });
  }

  if (senderId === receiverId) {
    return res.status(400).json({ message: 'ไม่สามารถส่งคำขอเพิ่มเพื่อนถึงตัวเองได้' });
  }

  try {
    const sender = await User.findById(senderId);
    const receiver = await User.findById(receiverId);

    if (!sender || !receiver) {
      return res.status(404).json({ message: 'ไม่พบผู้ส่งหรือผู้รับ' });
    }

    if (sender.friends.includes(receiverId)) {
      return res.status(400).json({ message: 'คุณเป็นเพื่อนกับผู้ใช้นี้อยู่แล้ว' });
    }

    const existingRequest = receiver.pendingFriendRequests.find(
      req => req.sender.toString() === senderId && req.status === 'pending'
    );
    if (existingRequest) {
      return res.status(400).json({ message: 'คุณได้ส่งคำขอเพิ่มเพื่อนไปแล้วและกำลังรอการตอบรับ' });
    }

    const reverseRequest = sender.pendingFriendRequests.find(
      req => req.sender.toString() === receiverId && req.status === 'pending'
    );
    if (reverseRequest) {
      return res.status(400).json({ message: 'ผู้ใช้นี้ได้ส่งคำขอเพิ่มเพื่อนมาหาคุณแล้ว กรุณาไปที่หน้าแจ้งเตือนเพื่อยอมรับ' });
    }

    receiver.pendingFriendRequests.push({ sender: senderId });
    await receiver.save();

    emitToUser(receiverId, 'friendRequestReceived', {
      senderId: sender._id.toString(),
      senderName: sender.name,
      senderEmail: sender.email
    });

    res.status(200).json({ message: 'ส่งคำขอเพิ่มเพื่อนสำเร็จ!' });

  } catch (error) {
    console.error('Error sending friend request:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการส่งคำขอเพิ่มเพื่อน' });
  }
});

app.get('/api/friend-requests/pending', verifyToken, async (req, res) => {
  const userId = req.user.userId;

  try {
    const user = await User.findById(userId).populate('pendingFriendRequests.sender', 'name email');

    if (!user) {
      return res.status(404).json({ message: 'ไม่พบผู้ใช้งาน' });
    }

    const pendingRequests = user.pendingFriendRequests.filter(req => req.status === 'pending');

    const formattedRequests = pendingRequests.map(request => ({
      _id: request._id.toString(),
      sender: {
        id: request.sender._id.toString(),
        name: request.sender.name,
        email: request.sender.email
      },
      status: request.status,
      createdAt: request.createdAt
    }));

    res.status(200).json({ requests: formattedRequests });

  } catch (error) {
    console.error('Error fetching pending friend requests:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงคำขอเพิ่มเพื่อน' });
  }
});

app.post('/api/friend-requests/accept', verifyToken, async (req, res) => {
  const { requestId } = req.body;
  const userId = req.user.userId;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'ไม่พบผู้ใช้งาน' });
    }

    const requestIndex = user.pendingFriendRequests.findIndex(
      req => req._id.toString() === requestId && req.status === 'pending'
    );

    if (requestIndex === -1) {
      return res.status(404).json({ message: 'ไม่พบคำขอเพิ่มเพื่อนนี้ หรือคำขอถูกจัดการไปแล้ว' });
    }

    const friendId = user.pendingFriendRequests[requestIndex].sender;

    if (user.friends.includes(friendId)) {
      user.pendingFriendRequests.splice(requestIndex, 1);
      await user.save();
      return res.status(400).json({ message: 'คุณเป็นเพื่อนกับผู้ใช้นี้อยู่แล้ว' });
    }

    user.friends.push(friendId);
    await user.save();

    const friendUser = await User.findById(friendId);
    if (friendUser) {
      friendUser.friends.push(userId);
      await friendUser.save();
    }

    user.pendingFriendRequests.splice(requestIndex, 1);
    await user.save();

    emitToUser(friendId.toString(), 'friendRequestAccepted', {
      accepterId: user._id.toString(),
      accepterName: user.name,
      accepterEmail: user.email
    });
    emitToUser(userId, 'friendListUpdated', { friendId: friendId.toString() });


    res.status(200).json({ message: 'ยอมรับคำขอเพิ่มเพื่อนสำเร็จ!' });

  } catch (error) {
    console.error('Error accepting friend request:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการยอมรับคำขอ' });
  }
});

app.post('/api/friend-requests/reject', verifyToken, async (req, res) => {
  const { requestId } = req.body;
  const userId = req.user.userId;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'ไม่พบผู้ใช้งาน' });
    }

    const requestIndex = user.pendingFriendRequests.findIndex(
      req => req._id.toString() === requestId && req.status === 'pending'
    );

    if (requestIndex === -1) {
      return res.status(404).json({ message: 'ไม่พบคำขอเพิ่มเพื่อนนี้ หรือคำขอถูกจัดการไปแล้ว' });
    }

    const friendId = user.pendingFriendRequests[requestIndex].sender;

    user.pendingFriendRequests.splice(requestIndex, 1);
    await user.save();

    emitToUser(friendId.toString(), 'friendRequestRejected', {
      rejecterId: user._id.toString(),
      rejecterName: user.name
    });
    emitToUser(userId, 'pendingRequestsUpdated', { requestId: requestId });


    res.status(200).json({ message: 'ปฏิเสธคำขอเพิ่มเพื่อนสำเร็จ!' });

  } catch (error) {
    console.error('Error rejecting friend request:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการปฏิเสธคำขอ' });
  }
});

app.get('/api/users/:id/friends', verifyToken, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId;

  if (userId !== id) {
    return res.status(403).json({ message: 'ไม่ได้รับอนุญาตให้ดูรายชื่อเพื่อนของผู้ใช้อื่น' });
  }

  try {
    const user = await User.findById(userId).populate('friends', 'name email');

    if (!user) {
      return res.status(404).json({ message: 'ไม่พบผู้ใช้งาน' });
    }

    const formattedFriends = user.friends.map(friend => ({
      id: friend._id.toString(),
      name: friend.name,
      email: friend.email
    }));

    res.status(200).json({ friends: formattedFriends });

  } catch (error) {
    console.error('Error fetching user friends:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงรายชื่อเพื่อน' });
  }
});

app.get('/api/messages/:friendId', verifyToken, async (req, res) => {
  const { friendId } = req.params;
  const userId = req.user.userId;

  try {
    const messages = await Message.find({
      $or: [
        { 'sender.id': userId, 'receiver.id': friendId },
        { 'sender.id': friendId, 'receiver.id': userId }
      ]
    })
    .sort({ timestamp: 1 });

    const formattedMessages = messages.map(msg => ({
      _id: msg._id.toString(),
      sender: { id: msg.sender.id.toString(), name: msg.sender.name },
      receiver: { id: msg.receiver.id.toString(), name: msg.receiver.name },
      content: msg.content,
      timestamp: msg.timestamp,
    }));

    res.status(200).json({ messages: formattedMessages });

  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อความ' });
  }
});

app.delete('/api/messages/:messageId', verifyToken, async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user.userId;

        const message = await Message.findById(messageId);

        if (!message) {
            return res.status(404).json({ message: 'ไม่พบข้อความ' });
        }

        if (message.sender.id.toString() !== userId) {
            return res.status(403).json({ message: 'ไม่ได้รับอนุญาต: คุณสามารถลบได้เฉพาะข้อความของคุณเอง' });
        }

        await Message.deleteOne({ _id: messageId });
        console.log(`Message ${messageId} deleted from DB.`);

        const conversationPartnerId = (message.sender.id.toString() === userId) ? message.receiver.id.toString() : message.sender.id.toString();

        io.to(userId).emit('messageDeleted', { messageId: message._id.toString(), conversationPartnerId: conversationPartnerId });
        if (userId !== conversationPartnerId) {
            io.to(conversationPartnerId).emit('messageDeleted', { messageId: message._id.toString(), conversationPartnerId: userId });
        }

        res.status(200).json({ message: 'ลบข้อความสำเร็จ' });
    } catch (error) {
        console.error('Error deleting message:', error);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดของเซิร์ฟเวอร์ขณะลบข้อความ' });
    }
});


const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Auth server listening on port ${PORT}`);
});
