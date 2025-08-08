// components/FloatingChatButton.jsx
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../app/context/AuthContext';
import io from 'socket.io-client'; // Import socket.io-client

// Component สำหรับหน้าต่างแชทแต่ละหน้าต่าง
const ChatWindow = ({ friend, onClose, initialRightOffset, onDragEnd, socket, currentUser, currentToken }) => {
  const [xPos, setXPos] = useState(initialRightOffset);
  const [isDragging, setIsDragging] = useState(false);
  const [startDragX, setStartDragX] = useState(0);
  const [initialWindowX, setInitialWindowX] = useState(0);
  const chatWindowRef = useRef(null);
  const messagesEndRef = useRef(null);
  const [messageInput, setMessageInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);

  // Effect สำหรับจัดการเหตุการณ์ลากเมาส์ทั่วทั้งเอกสาร
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;

      const deltaX = e.clientX - startDragX;
      let newXPos = initialWindowX - deltaX;
      const windowWidth = chatWindowRef.current ? chatWindowRef.current.offsetWidth : 320;
      const screenWidth = window.innerWidth;
      const minRight = 0;
      const maxRight = screenWidth - windowWidth - 24;
      newXPos = Math.max(minRight, Math.min(newXPos, maxRight));
      setXPos(newXPos);
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        onDragEnd(friend.id, xPos);
      }
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, startDragX, initialWindowX, xPos, friend.id, onDragEnd]);

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setStartDragX(e.clientX);
    setInitialWindowX(xPos);
    e.preventDefault();
  };

  // Fetch chat history when component mounts or friend changes
  useEffect(() => {
    const fetchMessages = async () => {
      // ใช้ currentToken ที่ส่งมาจาก props แทน currentUser?.token
      if (!currentUser?.id || !currentToken || !friend?.id) {
        console.log('ChatWindow: Pre-fetch check failed. Missing currentUser ID, Token, or friend info. CurrentUser:', currentUser, 'Token:', currentToken ? 'Available' : 'Not available', 'Friend:', friend);
        setIsLoadingMessages(false);
        return;
      }

      console.log('ChatWindow: Attempting to fetch messages for friend:', friend.name, 'ID:', friend.id, 'with token:', currentToken ? 'Available' : 'Not available');
      setIsLoadingMessages(true);
      try {
        const response = await fetch(`http://localhost:4000/api/messages/${friend.id}`, {
          headers: {
            'Authorization': `Bearer ${currentToken}` // ใช้ currentToken
          }
        });
        const data = await response.json();
        if (response.ok) {
          console.log('ChatWindow: Successfully fetched messages:', data.messages.length, 'messages.');
          setMessages(data.messages);
        } else {
          console.error('ChatWindow: Failed to fetch messages:', data.message);
          setMessages([]);
        }
      } catch (error) {
        console.error('ChatWindow: Error fetching messages:', error);
        setMessages([]);
      } finally {
        setIsLoadingMessages(false);
      }
    };

    if (currentUser?.id && friend?.id && currentToken) { // ตรวจสอบ currentToken ด้วย
        fetchMessages();
    } else {
        console.log('ChatWindow: Skipping initial message fetch due to missing user/friend IDs or token.');
        setIsLoadingMessages(false);
    }
  }, [friend?.id, currentUser?.id, currentToken]); // เพิ่ม currentToken ใน dependency array

  // Socket.IO listener for incoming messages and message deletion
  useEffect(() => {
    if (socket && currentUser?.id && friend?.id) {
      console.log('ChatWindow: Socket available, setting up receiveMessage and messageDeleted listeners.');
      
      const handleReceiveMessage = (message) => {
        console.log('ChatWindow: Received message from socket:', message);
        if ((message.sender.id === friend.id && message.receiver.id === currentUser.id) ||
            (message.sender.id === currentUser.id && message.receiver.id === friend.id)) {
          console.log('ChatWindow: Message is for this chat, updating messages state.');
          setMessages(prevMessages => [...prevMessages, message]);
        } else {
          console.log('ChatWindow: Message is NOT for this chat, ignoring.', message);
        }
      };

      const handleMessageDeleted = ({ messageId, conversationPartnerId }) => {
        if (conversationPartnerId === friend.id || conversationPartnerId === currentUser.id) {
          console.log('ChatWindow: Received messageDeleted event for messageId:', messageId, 'in this chat.');
          setMessages(prevMessages => prevMessages.filter(msg => msg._id !== messageId));
        } else {
          console.log('ChatWindow: Received messageDeleted event, but not for this chat window.', { messageId, conversationPartnerId });
        }
      };

      socket.on('receiveMessage', handleReceiveMessage);
      socket.on('messageDeleted', handleMessageDeleted);

      return () => {
        console.log('ChatWindow: Cleaning up socket listeners.');
        socket.off('receiveMessage', handleReceiveMessage);
        socket.off('messageDeleted', handleMessageDeleted);
      };
    } else {
      console.log('ChatWindow: Socket is NOT available or missing user/friend info for listener setup.');
    }
  }, [socket, friend?.id, currentUser?.id]);

  // Scroll to bottom when messages update
  useEffect(() => {
    console.log('ChatWindow: Messages state updated. Attempting to scroll to bottom. Current messages:', messages);
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // handleSendMessage function (ส่งข้อความผ่าน Socket.IO)
  const handleSendMessage = () => {
    console.log('ChatWindow: handleSendMessage called. Input:', messageInput);
    if (messageInput.trim() && socket && currentUser && friend) {
      const messageData = {
        senderId: currentUser.id,
        receiverId: friend.id,
        content: messageInput.trim(),
      };
      console.log('ChatWindow: Emitting sendMessage event with data:', messageData);
      socket.emit('sendMessage', messageData);
      setMessageInput('');
    } else {
      console.log('ChatWindow: Cannot send message. Missing input, socket, currentUser, or friend.');
      console.log({ messageInput, socket, currentUser, friend });
    }
  };

  // handle delete message
  const handleDeleteMessage = async (messageId) => {
    const confirmDelete = window.confirm("คุณแน่ใจหรือไม่ว่าต้องการลบข้อความนี้?");
    if (!confirmDelete) {
      return;
    }

    // Debug: ใช้ currentToken ที่ส่งมาจาก props
    console.log('handleDeleteMessage: currentUser:', currentUser);
    console.log('handleDeleteMessage: currentToken:', currentToken);

    if (!currentUser || !currentToken) { // ตรวจสอบ currentToken
      console.error('handleDeleteMessage: Missing currentUser or token. Cannot delete message.');
      alert('ไม่สามารถลบข้อความได้: ไม่พบข้อมูลผู้ใช้หรือ Token');
      return;
    }

    try {
      console.log('ChatWindow: Attempting to delete message with ID:', messageId);
      const response = await fetch(`http://localhost:4000/api/messages/${messageId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${currentToken}` // ใช้ currentToken
        }
      });

      if (response.ok) {
        console.log('ChatWindow: Message deletion request successful on backend.');
        // Backend จะส่ง socket event 'messageDeleted' กลับมาเพื่ออัปเดต UI
      } else {
        const errorData = await response.json();
        console.error('ChatWindow: Failed to delete message on backend:', errorData.message);
        alert(`ไม่สามารถลบข้อความได้: ${errorData.message}`);
      }
    } catch (error) {
      console.error('ChatWindow: Error sending delete request:', error);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อเพื่อลบข้อความ');
    }
  };


  return (
    <div
      ref={chatWindowRef}
      className="fixed bottom-0 z-50 flex flex-col bg-white rounded-t-lg shadow-xl"
      style={{ width: '320px', height: '400px', bottom: '0px', right: `${xPos}px` }}
    >
      <div
        className="flex justify-between items-center p-4 border-b border-gray-200 cursor-grab"
        onMouseDown={handleMouseDown}
      >
        <h2 className="text-lg font-semibold text-gray-800">{friend.name}</h2>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 focus:outline-none"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="flex-grow p-4 overflow-y-auto text-gray-700 flex flex-col space-y-2">
        {isLoadingMessages ? (
          <div className="flex-grow flex items-center justify-center text-gray-500">
            <p>กำลังโหลดข้อความ...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex-grow flex items-center justify-center text-gray-500">
            <p>ยังไม่มีข้อความในแชทนี้</p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={msg._id || index}
              className={`flex ${msg.sender.id === currentUser.id ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] p-2 rounded-lg relative ${ // Added relative for positioning delete button
                  msg.sender.id === currentUser.id
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-800'
                }`}
              >
                <p className="text-xs font-semibold">{msg.sender.id === currentUser.id ? 'คุณ' : msg.sender.name}</p>
                <p className="break-words">{msg.content}</p>
                <p className="text-right text-[0.65rem] opacity-75 mt-1">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
                {/* Delete button (only for sender's messages) */}
                {msg.sender.id === currentUser.id && (
                  <button
                    onClick={() => handleDeleteMessage(msg._id)}
                    className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shadow-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500" // Adjusted size, position, and removed opacity classes
                    aria-label="ลบข้อความ"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-2 border-t border-gray-200 text-sm text-gray-500 flex items-center space-x-2">
        <input
          type="text"
          placeholder="พิมพ์ข้อความ..."
          className="flex-grow px-2 py-1 border rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900"
          value={messageInput}
          onChange={(e) => setMessageInput(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              handleSendMessage();
            }
          }}
          name="messageInput"
        />
        <button
          onClick={handleSendMessage}
          className="bg-blue-500 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          ส่ง
        </button>
      </div>
    </div>
  );
};

export default function FloatingChatButton() {
  const { user, token } = useAuth(); // ดึง user และ token จาก useAuth
  const [isOpen, setIsOpen] = useState(false);
  const [isAddFriendPanelOpen, setIsAddFriendPanelOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [activeTab, setActiveTab] = useState('chats');
  const [friendsList, setFriendsList] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [openChatWindows, setOpenChatWindows] = useState([]);
  const [socket, setSocket] = useState(null);

  console.log("FloatingChatButton render. User:", user, "Token:", token ? "Available" : "Not Available");

  useEffect(() => {
    if (user && user.id) {
      const newSocket = io('http://localhost:4000');
      setSocket(newSocket);
      newSocket.on('connect', () => {
        console.log('Socket.IO connected:', newSocket.id);
        newSocket.emit('register', user.id);
      });
      newSocket.on('friendRequestReceived', (data) => {
        console.log('Friend request received:', data);
        alert(`คุณได้รับคำขอเพิ่มเพื่อนจาก ${data.senderName}`);
        fetchFriendsAndRequests();
      });
      newSocket.on('friendRequestAccepted', (data) => {
        console.log('Friend request accepted:', data);
        alert(`${data.accepterName} ยอมรับคำขอเพิ่มเพื่อนของคุณแล้ว`);
        fetchFriendsAndRequests();
      });
      newSocket.on('friendRequestRejected', (data) => {
        console.log('Friend request rejected:', data);
        alert(`${data.rejecterName} ปฏิเสธคำขอเพิ่มเพื่อนของคุณ`);
        fetchFriendsAndRequests();
      });
      newSocket.on('friendListUpdated', (data) => {
        console.log('Friend list updated:', data);
        fetchFriendsAndRequests();
      });
      newSocket.on('pendingRequestsUpdated', (data) => {
        console.log('Pending requests updated:', data);
        fetchFriendsAndRequests();
      });
      newSocket.on('disconnect', () => {
        console.log('Socket.IO disconnected');
      });
      return () => {
        newSocket.disconnect();
      };
    }
  }, [user]);

  useEffect(() => {
    // ตรวจสอบ token ที่นี่ เพื่อให้แน่ใจว่าพร้อมใช้งานก่อน fetch
    if (isOpen && user && token) {
      fetchFriendsAndRequests();
    }
  }, [isOpen, user, token]); // เพิ่ม token ใน dependency array

  const fetchFriendsAndRequests = async () => {
    setIsLoadingFriends(true);
    // ตรวจสอบ token อีกครั้งก่อน fetch
    if (!token) {
      console.error('fetchFriendsAndRequests: Token is not available.');
      setIsLoadingFriends(false);
      return;
    }
    try {
      const friendsResponse = await fetch(`http://localhost:4000/api/users/${user.id}/friends`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const friendsData = await friendsResponse.json();
      if (friendsResponse.ok) {
        setFriendsList(friendsData.friends);
      } else {
        console.error('Failed to fetch friends:', friendsData.message);
        setFriendsList([]);
      }
      const requestsResponse = await fetch(`http://localhost:4000/api/friend-requests/pending`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const requestsData = await requestsResponse.json();
      if (requestsResponse.ok) {
        setPendingRequests(requestsData.requests);
      } else {
        console.error('Failed to fetch pending requests:', requestsData.message);
        setPendingRequests([]);
      }
    } catch (error) {
      console.error('Error fetching friends or requests:', error);
    } finally {
      setIsLoadingFriends(false);
    }
  };

  const toggleChatPanel = () => {
    setIsOpen(!isOpen);
    if (isOpen) {
      setIsAddFriendPanelOpen(false);
      setSearchQuery('');
      setSearchResults([]);
      setSearchError('');
    } else {
      setActiveTab('chats');
    }
  };
  const openAddFriendPanel = () => {
    setIsAddFriendPanelOpen(true);
    setSearchResults([]);
    setSearchError('');
  };
  const closeAddFriendPanel = () => {
    setIsAddFriendPanelOpen(false);
    setSearchQuery('');
    setSearchResults([]);
    setSearchError('');
  };
  const handleSearchFriend = async () => {
    if (!searchQuery.trim()) {
      setSearchError('กรุณากรอกชื่อผู้ใช้หรืออีเมลเพื่อค้นหา');
      setSearchResults([]);
      return;
    }
    setIsLoadingSearch(true);
    setSearchResults([]);
    setSearchError('');
    // ตรวจสอบ token อีกครั้งก่อน fetch
    if (!token) {
      console.error('handleSearchFriend: Token is not available.');
      setSearchError('ไม่สามารถค้นหาได้: ไม่พบ Token ผู้ใช้');
      setIsLoadingSearch(false);
      return;
    }
    try {
      const response = await fetch(`http://localhost:4000/api/users/search?query=${encodeURIComponent(searchQuery)}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok) {
        setSearchResults(data.users);
        if (data.users.length === 0) {
          setSearchError('ไม่พบผู้ใช้งานที่ตรงกับคำค้นหา');
        }
      } else {
        setSearchError(data.message || 'เกิดข้อผิดพลาดในการค้นหา');
      }
    } catch (error) {
      console.error('Error searching for friend:', error);
      setSearchError('เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์');
    } finally {
      setIsLoadingSearch(false);
    }
  };
  const handleSendFriendRequest = async (receiverId) => {
    if (!receiverId) {
        alert('เกิดข้อผิดพลาด: ไม่สามารถส่งคำขอได้เนื่องจากข้อมูลผู้รับไม่สมบูรณ์');
        return;
    }
    // ตรวจสอบ token อีกครั้งก่อน fetch
    if (!token) {
      console.error('handleSendFriendRequest: Token is not available.');
      alert('ไม่สามารถส่งคำขอได้: ไม่พบ Token ผู้ใช้');
      return;
    }
    try {
      const response = await fetch('http://localhost:4000/api/friend-requests/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ receiverId }),
      });
      const data = await response.json();
      if (response.ok) {
        alert(data.message);
        closeAddFriendPanel();
      } else {
        let errorMessage = data.message || 'เกิดข้อผิดพลาดในการส่งคำขอเพิ่มเพื่อน';
        if (errorMessage === 'ไม่พบ ID ผู้รับ') {
            errorMessage = 'เกิดข้อผิดพลาด: ไม่สามารถส่งคำขอได้ (ID ผู้รับไม่ถูกต้อง)';
        }
        alert(errorMessage);
      }
    } catch (error) {
      console.error('Error sending friend request:', error);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์');
    }
  };
  const handleAcceptRequest = async (requestId) => {
    // ตรวจสอบ token อีกครั้งก่อน fetch
    if (!token) {
      console.error('handleAcceptRequest: Token is not available.');
      alert('ไม่สามารถยอมรับคำขอได้: ไม่พบ Token ผู้ใช้');
      return;
    }
    try {
      const response = await fetch('http://localhost:4000/api/friend-requests/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ requestId }),
      });
      const data = await response.json();
      if (response.ok) {
        alert(data.message);
        fetchFriendsAndRequests();
      } else {
        alert(data.message || 'เกิดข้อผิดพลาดในการยอมรับคำขอ');
      }
    } catch (error) {
      console.error('Error accepting friend request:', error);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์');
    }
  };
  const handleRejectRequest = async (requestId) => {
    // ตรวจสอบ token อีกครั้งก่อน fetch
    if (!token) {
      console.error('handleRejectRequest: Token is not available.');
      alert('ไม่สามารถปฏิเสธคำขอได้: ไม่พบ Token ผู้ใช้');
      return;
    }
    try {
      const response = await fetch('http://localhost:4000/api/friend-requests/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ requestId }),
      });
      const data = await response.json();
      if (response.ok) {
        alert(data.message);
        fetchFriendsAndRequests();
      } else {
        alert(data.message || 'เกิดข้อผิดพลาดในการปฏิเสธคำขอ');
      }
    } catch (error) {
      console.error('Error rejecting friend request:', error);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์');
    }
  };
  const handleOpenChat = (friend) => {
    if (!openChatWindows.find(chat => chat.id === friend.id)) {
      setOpenChatWindows(prevWindows => {
        const windowWidth = 320;
        const spacing = 24;
        const baseOffset = 40;
        const newRightOffset = baseOffset + (prevWindows.length * (windowWidth + spacing));
        return [...prevWindows, { ...friend, initialRightOffset: newRightOffset }];
      });
    }
  };
  const handleCloseChat = (friendId) => {
    setOpenChatWindows(prevWindows => {
      const updatedWindows = prevWindows.filter(chat => chat.id !== friendId);
      return updatedWindows.map((chat, index) => {
        const windowWidth = 320;
        const spacing = 24;
        const baseOffset = 40;
        const newRightOffset = baseOffset + (index * (windowWidth + spacing));
        return { ...chat, initialRightOffset: newRightOffset };
      });
    });
  };
  const handleChatWindowDragEnd = (friendId, newRightPosition) => {
    setOpenChatWindows(prevWindows =>
      prevWindows.map(chat =>
        chat.id === friendId ? { ...chat, initialRightOffset: newRightPosition } : chat
      )
    );
  };
  return (
    <>
      {!isOpen && (
        <button
          onClick={toggleChatPanel}
          className="fixed bottom-6 right-6 bg-green-500 text-white p-4 rounded-full shadow-lg hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 z-50 transition-all duration-300 transform hover:scale-105"
          aria-label="Open chat and friends"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.504 12.53 2 11.235 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
          </svg>
        </button>
      )}
      <div
        className={`
          fixed bottom-0 right-0 z-40 flex items-end justify-end p-4 w-full h-full
          transition-opacity duration-300
          ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
        `}
      >
        <div className="bg-white rounded-lg shadow-xl w-full max-w-sm h-[600px] flex flex-col relative bottom-4 right-4">
          <div className="flex justify-between items-center p-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800">แชท</h2>
            <button
              onClick={toggleChatPanel}
              className="text-gray-500 hover:text-gray-700 focus:outline-none"
              aria-label="Close chat and friends"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex border-b border-gray-200">
            <button
              className={`flex-1 py-2 text-center font-medium ${activeTab === 'chats' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setActiveTab('chats')}
            >
              แชท ({friendsList.length})
            </button>
            <button
              className={`flex-1 py-2 text-center font-medium ${activeTab === 'notifications' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setActiveTab('notifications')}
            >
              แจ้งเตือน ({pendingRequests.length})
            </button>
          </div>
          <div className="flex-grow p-4 overflow-y-auto text-gray-700 flex flex-col">
            {isLoadingFriends ? (
              <div className="flex-grow flex items-center justify-center text-gray-500">
                <p>กำลังโหลดข้อมูล...</p>
              </div>
            ) : (
              <>
                {activeTab === 'chats' && (
                  <>
                    {friendsList.length === 0 ? (
                      <div className="flex-grow flex items-center justify-center">
                        <p className="text-center text-gray-500">ยังไม่มีการสนทนา</p>
                      </div>
                    ) : (
                      <div className="flex-grow overflow-y-auto">
                        {friendsList.map(friend => (
                          <div
                            key={friend.id?.toString()}
                            className="flex items-center p-3 border-b last:border-b-0 cursor-pointer hover:bg-gray-100 rounded-md"
                            onClick={() => handleOpenChat(friend)}
                          >
                            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-bold text-lg mr-3">
                              {friend.name ? friend.name.charAt(0).toUpperCase() : 'U'}
                            </div>
                            <p className="font-semibold text-gray-800">{friend.name}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
                {activeTab === 'notifications' && (
                  <>
                    {pendingRequests.length === 0 ? (
                      <div className="flex-grow flex items-center justify-center">
                        <p className="text-center text-gray-500">ไม่มีการแจ้งเตือน</p>
                      </div>
                    ) : (
                      <div className="flex-grow overflow-y-auto">
                        {pendingRequests.map(request => (
                          <div key={request._id?.toString()} className="flex items-center justify-between p-3 border-b last:border-b-0 bg-white">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 rounded-full bg-yellow-200 flex items-center justify-center text-yellow-800 font-bold text-lg">
                                {request.sender.name ? request.sender.name.charAt(0).toUpperCase() : 'U'}
                              </div>
                              <div>
                                <p className="font-semibold text-gray-800">{request.sender.name}</p>
                                <p className="text-sm text-gray-500">ส่งคำขอเพิ่มเพื่อน</p>
                              </div>
                            </div>
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleAcceptRequest(request._id.toString())}
                                className="bg-green-500 text-white px-3 py-1 rounded-md text-sm hover:bg-green-600"
                              >
                                ยอมรับ
                              </button>
                              <button
                                onClick={() => handleRejectRequest(request._id.toString())}
                                className="bg-red-500 text-white px-3 py-1 rounded-md text-sm hover:bg-red-600"
                              >
                                ปฏิเสธ
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
          <div className="p-4 border-t border-gray-200 text-sm text-gray-500 flex justify-between items-center">
            <span>HealthConnect Chat System</span>
            <button
              className="bg-blue-500 text-white px-4 py-2 rounded-md shadow-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 text-sm"
              onClick={openAddFriendPanel}
            >
              เพิ่มเพื่อน
            </button>
          </div>
        </div>
      </div>
      {openChatWindows.map((friend, index) => {
        const rightPosition = friend.initialRightOffset;
        // ส่ง user และ token จาก useAuth ไปยัง ChatWindow โดยตรง
        if (!user || !user.id || !token) {
          console.log("FloatingChatButton: Skipping ChatWindow render as user/token is not fully loaded yet.");
          return null;
        }
        return (
          <ChatWindow
            key={friend.id}
            friend={friend}
            onClose={() => handleCloseChat(friend.id)}
            initialRightOffset={rightPosition}
            onDragEnd={handleChatWindowDragEnd}
            socket={socket}
            currentUser={user} // ส่ง user object
            currentToken={token} // ส่ง token โดยตรง
          />
        );
      })}
    </>
  );
}
