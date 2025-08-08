// components/FloatingChatButton.jsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../app/context/AuthContext";
import io from "socket.io-client";

// หน้าต่างแชทแต่ละอัน
const ChatWindow = ({
  friend,
  onClose,
  initialRightOffset,
  onDragEnd,
  socket,
  currentUser,
  currentToken,
}) => {
  const [xPos, setXPos] = useState(initialRightOffset);
  const [isDragging, setIsDragging] = useState(false);
  const [startDragX, setStartDragX] = useState(0);
  const [initialWindowX, setInitialWindowX] = useState(0);
  const chatWindowRef = useRef(null);
  const messagesEndRef = useRef(null);
  const [messageInput, setMessageInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);

  // handle dragging
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;

      const deltaX = e.clientX - startDragX;
      let newXPos = initialWindowX - deltaX;
      const windowWidth = chatWindowRef.current
        ? chatWindowRef.current.offsetWidth
        : 320;
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
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    } else {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, startDragX, initialWindowX, xPos, friend.id, onDragEnd]);

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setStartDragX(e.clientX);
    setInitialWindowX(xPos);
    e.preventDefault();
  };

  // ดึงประวัติแชท
  useEffect(() => {
    const fetchMessages = async () => {
      if (!currentUser?.id || !currentToken || !friend?.id) {
        console.log(
          "ChatWindow: Pre-fetch check failed.",
          { currentUser, hasToken: !!currentToken, friend }
        );
        setIsLoadingMessages(false);
        return;
      }

      setIsLoadingMessages(true);
      try {
        const response = await fetch(
          `http://localhost:4000/api/messages/${friend.id}`,
          {
            headers: {
              Authorization: `Bearer ${currentToken}`,
            },
          }
        );
        const data = await response.json();
        if (response.ok) {
          setMessages(Array.isArray(data.messages) ? data.messages : []);
        } else {
          console.error("ChatWindow: Failed to fetch messages:", data.message);
          setMessages([]);
        }
      } catch (error) {
        console.error("ChatWindow: Error fetching messages:", error);
        setMessages([]);
      } finally {
        setIsLoadingMessages(false);
      }
    };

    if (currentUser?.id && friend?.id && currentToken) {
      fetchMessages();
    } else {
      setIsLoadingMessages(false);
    }
  }, [friend?.id, currentUser?.id, currentToken]);

  // Socket.IO listener
  useEffect(() => {
    if (socket && currentUser?.id && friend?.id) {
      const handleReceiveMessage = (message) => {
        if (
          (message.sender.id === friend.id &&
            message.receiver.id === currentUser.id) ||
          (message.sender.id === currentUser.id &&
            message.receiver.id === friend.id)
        ) {
          setMessages((prev) => [...prev, message]);
        }
      };

      const handleMessageDeleted = ({ messageId, conversationPartnerId }) => {
        if (
          conversationPartnerId === friend.id ||
          conversationPartnerId === currentUser.id
        ) {
          setMessages((prev) => prev.filter((msg) => msg._id !== messageId));
        }
      };

      socket.on("receiveMessage", handleReceiveMessage);
      socket.on("messageDeleted", handleMessageDeleted);

      return () => {
        socket.off("receiveMessage", handleReceiveMessage);
        socket.off("messageDeleted", handleMessageDeleted);
      };
    }
  }, [socket, friend?.id, currentUser?.id]);

  // เลื่อนลงล่างสุดเมื่อ messages เปลี่ยน
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ส่งข้อความ
  const handleSendMessage = () => {
    if (messageInput.trim() && socket && currentUser && friend) {
      const messageData = {
        senderId: currentUser.id,
        receiverId: friend.id,
        content: messageInput.trim(),
      };
      socket.emit("sendMessage", messageData);
      setMessageInput("");
    }
  };

  // ลบข้อความ
  const handleDeleteMessage = async (messageId) => {
    const confirmDelete = window.confirm(
      "คุณแน่ใจหรือไม่ว่าต้องการลบข้อความนี้?"
    );
    if (!confirmDelete) return;

    if (!currentUser || !currentToken) {
      console.error("handleDeleteMessage: missing auth");
      alert("ไม่สามารถลบข้อความได้: ไม่พบข้อมูลผู้ใช้หรือ Token");
      return;
    }

    try {
      const response = await fetch(
        `http://localhost:4000/api/messages/${messageId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${currentToken}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error(
          "ChatWindow: Failed to delete message on backend:",
          errorData.message
        );
        alert(`ไม่สามารถลบข้อความได้: ${errorData.message}`);
      }
      // ถ้าสำเร็จ backend จะยิง socket 'messageDeleted' เอง
    } catch (error) {
      console.error("ChatWindow: Error sending delete request:", error);
      alert("เกิดข้อผิดพลาดในการเชื่อมต่อเพื่อลบข้อความ");
    }
  };

  return (
    <div
      ref={chatWindowRef}
      className="fixed bottom-0 z-50 flex flex-col bg-white rounded-t-lg shadow-xl"
      style={{ width: 320, height: 400, bottom: 0, right: xPos }}
    >
      <div
        className="flex justify-between items-center p-4 border-b border-gray-200 cursor-grab"
        onMouseDown={handleMouseDown}
      >
        <h2 className="text-lg font-semibold text-gray-800">{friend.name}</h2>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 focus:outline-none"
          aria-label="ปิดหน้าต่างแชท"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
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
          messages.map((msg, index) => {
            const isMe = msg?.sender?.id === currentUser.id;
            const timeStr = msg?.timestamp
              ? new Date(msg.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "";
            return (
              <div
                key={msg?._id || index}
                className={`flex ${isMe ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] p-2 rounded-lg relative ${
                    isMe ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-800"
                  }`}
                >
                  <p className="text-xs font-semibold">
                    {isMe ? "คุณ" : msg?.sender?.name || "ผู้ใช้"}
                  </p>
                  <p className="break-words">{msg?.content}</p>
                  <p className="text-right text-[0.65rem] opacity-75 mt-1">
                    {timeStr}
                  </p>

                  {isMe && (
                    <button
                      onClick={() => handleDeleteMessage(msg._id)}
                      className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shadow-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      aria-label="ลบข้อความ"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            );
          })
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
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSendMessage();
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
  const { user, token } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isAddFriendPanelOpen, setIsAddFriendPanelOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [activeTab, setActiveTab] = useState("chats");
  const [friendsList, setFriendsList] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [openChatWindows, setOpenChatWindows] = useState([]);
  const [socket, setSocket] = useState(null);

  // สร้าง socket เมื่อมี user.id
  useEffect(() => {
    if (user?.id) {
      const newSocket = io("http://localhost:4000");
      setSocket(newSocket);

      newSocket.on("connect", () => {
        newSocket.emit("register", user.id);
      });

      newSocket.on("friendRequestReceived", (data) => {
        alert(`คุณได้รับคำขอเพิ่มเพื่อนจาก ${data.senderName}`);
        fetchFriendsAndRequests();
      });
      newSocket.on("friendRequestAccepted", (data) => {
        alert(`${data.accepterName} ยอมรับคำขอเพิ่มเพื่อนของคุณแล้ว`);
        fetchFriendsAndRequests();
      });
      newSocket.on("friendRequestRejected", (data) => {
        alert(`${data.rejecterName} ปฏิเสธคำขอเพิ่มเพื่อนของคุณ`);
        fetchFriendsAndRequests();
      });
      newSocket.on("friendListUpdated", () => {
        fetchFriendsAndRequests();
      });
      newSocket.on("pendingRequestsUpdated", () => {
        fetchFriendsAndRequests();
      });

      newSocket.on("disconnect", () => {
        // noop
      });

      return () => {
        newSocket.disconnect();
      };
    }
  }, [user?.id]); // ผูกกับ user.id เท่านั้น

  // โหลด friends/requests เมื่อเปิด panel และมี token พร้อม
  useEffect(() => {
    if (isOpen && user?.id && token) {
      fetchFriendsAndRequests();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, user?.id, token]);

  const fetchFriendsAndRequests = async () => {
    setIsLoadingFriends(true);
    const currentUserId = user?.id;
    const currentToken = token;

    if (!currentUserId || !currentToken) {
      setIsLoadingFriends(false);
      return;
    }
    try {
      const friendsResponse = await fetch(
        `http://localhost:4000/api/users/${currentUserId}/friends`,
        {
          headers: { Authorization: `Bearer ${currentToken}` },
        }
      );
      const friendsData = await friendsResponse.json();
      if (friendsResponse.ok) {
        setFriendsList(Array.isArray(friendsData.friends) ? friendsData.friends : []);
      } else {
        console.error("Failed to fetch friends:", friendsData.message);
        setFriendsList([]);
      }

      const requestsResponse = await fetch(
        `http://localhost:4000/api/friend-requests/pending`,
        {
          headers: { Authorization: `Bearer ${currentToken}` },
        }
      );
      const requestsData = await requestsResponse.json();
      if (requestsResponse.ok) {
        setPendingRequests(
          Array.isArray(requestsData.requests) ? requestsData.requests : []
        );
      } else {
        console.error("Failed to fetch pending requests:", requestsData.message);
        setPendingRequests([]);
      }
    } catch (error) {
      console.error("Error fetching friends or requests:", error);
    } finally {
      setIsLoadingFriends(false);
    }
  };

  const toggleChatPanel = () => {
    setIsOpen((prev) => !prev);
    if (isOpen) {
      setIsAddFriendPanelOpen(false);
      setSearchQuery("");
      setSearchResults([]);
      setSearchError("");
    } else {
      setActiveTab("chats");
    }
  };

  const openAddFriendPanel = () => {
    setIsAddFriendPanelOpen(true);
    setSearchQuery("");
    setSearchResults([]);
    setSearchError("");
  };
  const closeAddFriendPanel = () => {
    setIsAddFriendPanelOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    setSearchError("");
  };

  const handleSearchFriend = async () => {
    if (!searchQuery.trim()) {
      setSearchError("กรุณากรอกชื่อผู้ใช้หรืออีเมลเพื่อค้นหา");
      setSearchResults([]);
      return;
    }
    setIsLoadingSearch(true);
    setSearchResults([]);
    setSearchError("");

    const currentToken = token;
    if (!currentToken) {
      setSearchError("ไม่สามารถค้นหาได้: ไม่พบ Token ผู้ใช้");
      setIsLoadingSearch(false);
      return;
    }
    try {
      const response = await fetch(
        `http://localhost:4000/api/users/search?query=${encodeURIComponent(
          searchQuery
        )}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${currentToken}`,
          },
        }
      );
      const data = await response.json();
      if (response.ok) {
        const usersArr = Array.isArray(data.users) ? data.users : [];
        setSearchResults(usersArr);
        if (usersArr.length === 0) {
          setSearchError("ไม่พบผู้ใช้งานที่ตรงกับคำค้นหา");
        }
      } else {
        setSearchError(data.message || "เกิดข้อผิดพลาดในการค้นหา");
      }
    } catch (error) {
      console.error("Error searching for friend:", error);
      setSearchError("เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์");
    } finally {
      setIsLoadingSearch(false);
    }
  };

  const handleSendFriendRequest = async (receiverId) => {
    if (!receiverId) {
      alert(
        "เกิดข้อผิดพลาด: ไม่สามารถส่งคำขอได้เนื่องจากข้อมูลผู้รับไม่สมบูรณ์"
      );
      return;
    }
    const currentToken = token;
    if (!currentToken) {
      alert("ไม่สามารถส่งคำขอได้: ไม่พบ Token ผู้ใช้");
      return;
    }
    try {
      const response = await fetch(
        `http://localhost:4000/api/friend-requests/send`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${currentToken}`,
          },
          body: JSON.stringify({ receiverId }),
        }
      );
      const data = await response.json();
      if (response.ok) {
        alert(data.message);
        closeAddFriendPanel();
      } else {
        let errorMessage =
          data.message || "เกิดข้อผิดพลาดในการส่งคำขอเพิ่มเพื่อน";
        if (errorMessage === "ไม่พบ ID ผู้รับ") {
          errorMessage =
            "เกิดข้อผิดพลาด: ไม่สามารถส่งคำขอได้ (ID ผู้รับไม่ถูกต้อง)";
        }
        alert(errorMessage);
      }
    } catch (error) {
      console.error("Error sending friend request:", error);
      alert("เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์");
    }
  };

  const handleAcceptRequest = async (requestId) => {
    const currentToken = token;
    if (!currentToken) {
      alert("ไม่สามารถยอมรับคำขอได้: ไม่พบ Token ผู้ใช้");
      return;
    }
    try {
      const response = await fetch(
        `http://localhost:4000/api/friend-requests/accept`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${currentToken}`,
          },
          body: JSON.stringify({ requestId }),
        }
      );
      const data = await response.json();
      if (response.ok) {
        alert(data.message);
        fetchFriendsAndRequests();
      } else {
        alert(data.message || "เกิดข้อผิดพลาดในการยอมรับคำขอ");
      }
    } catch (error) {
      console.error("Error accepting friend request:", error);
      alert("เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์");
    }
  };

  const handleRejectRequest = async (requestId) => {
    const currentToken = token;
    if (!currentToken) {
      alert("ไม่สามารถปฏิเสธคำขอได้: ไม่พบ Token ผู้ใช้");
      return;
    }
    try {
      const response = await fetch(
        `http://localhost:4000/api/friend-requests/reject`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${currentToken}`,
          },
          body: JSON.stringify({ requestId }),
        }
      );
      const data = await response.json();
      if (response.ok) {
        alert(data.message);
        fetchFriendsAndRequests();
      } else {
        alert(data.message || "เกิดข้อผิดพลาดในการปฏิเสธคำขอ");
      }
    } catch (error) {
      console.error("Error rejecting friend request:", error);
      alert("เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์");
    }
  };

  const handleOpenChat = (friend) => {
    setOpenChatWindows((prevWindows) => {
      if (prevWindows.find((chat) => chat.id === friend.id)) return prevWindows;
      const windowWidth = 320;
      const spacing = 24;
      const baseOffset = 40;
      const newRightOffset =
        baseOffset + prevWindows.length * (windowWidth + spacing);
      return [...prevWindows, { ...friend, initialRightOffset: newRightOffset }];
    });
  };

  const handleCloseChat = (friendId) => {
    setOpenChatWindows((prevWindows) => {
      const updatedWindows = prevWindows.filter((chat) => chat.id !== friendId);
      return updatedWindows.map((chat, index) => {
        const windowWidth = 320;
        const spacing = 24;
        const baseOffset = 40;
        const newRightOffset = baseOffset + index * (windowWidth + spacing);
        return { ...chat, initialRightOffset: newRightOffset };
      });
    });
  };

  const handleChatWindowDragEnd = (friendId, newRightPosition) => {
    setOpenChatWindows((prevWindows) =>
      prevWindows.map((chat) =>
        chat.id === friendId
          ? { ...chat, initialRightOffset: newRightPosition }
          : chat
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
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.504 12.53 2 11.235 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      )}

      <div
        className={`fixed bottom-0 right-0 z-40 flex items-end justify-end p-4 w-full h-full transition-opacity duration-300 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="bg-white rounded-lg shadow-xl w-full max-w-sm h-[600px] flex flex-col relative bottom-4 right-4">
          <div className="flex justify-between items-center p-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800">แชท</h2>
            <button
              onClick={toggleChatPanel}
              className="text-gray-500 hover:text-gray-700 focus:outline-none"
              aria-label="Close chat and friends"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              className={`flex-1 py-2 text-center font-medium ${
                activeTab === "chats" && !isAddFriendPanelOpen
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => {
                setActiveTab("chats");
                closeAddFriendPanel();
              }}
            >
              แชท ({friendsList?.length ?? 0})
            </button>
            <button
              className={`flex-1 py-2 text-center font-medium ${
                activeTab === "notifications" && !isAddFriendPanelOpen
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => {
                setActiveTab("notifications");
                closeAddFriendPanel();
              }}
            >
              แจ้งเตือน ({pendingRequests?.length ?? 0})
            </button>
          </div>

          {/* Content */}
          <div className="flex-grow p-4 overflow-y-auto text-gray-700 flex flex-col">
            {isLoadingFriends ? (
              <div className="flex-grow flex items-center justify-center text-gray-500">
                <p>กำลังโหลดข้อมูล...</p>
              </div>
            ) : (
              <>
                {isAddFriendPanelOpen ? (
                  <div className="flex-grow flex flex-col space-y-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        placeholder="ค้นหาด้วยชื่อหรืออีเมล..."
                        className="flex-grow px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSearchFriend();
                        }}
                      />
                      <button
                        onClick={handleSearchFriend}
                        className="bg-blue-500 text-white px-4 py-2 rounded-md shadow-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        disabled={isLoadingSearch}
                      >
                        {isLoadingSearch ? "กำลังค้นหา..." : "ค้นหา"}
                      </button>
                    </div>

                    {searchError && (
                      <p className="text-red-500 text-sm text-center">
                        {searchError}
                      </p>
                    )}

                    {searchResults.length > 0 && (
                      <div className="flex-grow overflow-y-auto border rounded-md">
                        {searchResults.map((resultUser) => (
                          <div
                            key={resultUser.id}
                            className="flex items-center justify-between p-3 border-b last:border-b-0 hover:bg-gray-100"
                          >
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 rounded-full bg-purple-200 flex items-center justify-center text-purple-800 font-bold text-lg">
                                {resultUser.name
                                  ? resultUser.name.charAt(0).toUpperCase()
                                  : "U"}
                              </div>
                              <div>
                                <p className="font-semibold text-gray-800">
                                  {resultUser.name}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {resultUser.email}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() =>
                                handleSendFriendRequest(resultUser.id)
                              }
                              className="bg-green-500 text-white px-3 py-1 rounded-md text-sm hover:bg-green-600"
                            >
                              เพิ่ม
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {activeTab === "chats" && (
                      <>
                        {friendsList.length === 0 ? (
                          <div className="flex-grow flex items-center justify-center">
                            <p className="text-center text-gray-500">
                              ยังไม่มีการสนทนา
                            </p>
                          </div>
                        ) : (
                          <div className="flex-grow overflow-y-auto">
                            {friendsList.map((friend) => (
                              <div
                                key={friend.id?.toString()}
                                className="flex items-center p-3 border-b last:border-b-0 cursor-pointer hover:bg-gray-100 rounded-md"
                                onClick={() => handleOpenChat(friend)}
                              >
                                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-bold text-lg mr-3">
                                  {friend.name
                                    ? friend.name.charAt(0).toUpperCase()
                                    : "U"}
                                </div>
                                <p className="font-semibold text-gray-800">
                                  {friend.name}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}

                    {activeTab === "notifications" && (
                      <>
                        {pendingRequests.length === 0 ? (
                          <div className="flex-grow flex items-center justify-center">
                            <p className="text-center text-gray-500">
                              ไม่มีการแจ้งเตือน
                            </p>
                          </div>
                        ) : (
                          <div className="flex-grow overflow-y-auto">
                            {pendingRequests.map((request) => (
                              <div
                                key={request._id?.toString()}
                                className="flex items-center justify-between p-3 border-b last:border-b-0 bg-white"
                              >
                                <div className="flex items-center space-x-3">
                                  <div className="w-10 h-10 rounded-full bg-yellow-200 flex items-center justify-center text-yellow-800 font-bold text-lg">
                                    {request.sender?.name
                                      ? request.sender.name
                                          .charAt(0)
                                          .toUpperCase()
                                      : "U"}
                                  </div>
                                  <div>
                                    <p className="font-semibold text-gray-800">
                                      {request.sender?.name || "ผู้ใช้"}
                                    </p>
                                    <p className="text-sm text-gray-500">
                                      ส่งคำขอเพิ่มเพื่อน
                                    </p>
                                  </div>
                                </div>
                                <div className="flex space-x-2">
                                  <button
                                    onClick={() =>
                                      handleAcceptRequest(
                                        request._id.toString()
                                      )
                                    }
                                    className="bg-green-500 text-white px-3 py-1 rounded-md text-sm hover:bg-green-600"
                                  >
                                    ยอมรับ
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleRejectRequest(
                                        request._id.toString()
                                      )
                                    }
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

      {openChatWindows.map((friend) => {
        const rightPosition = friend.initialRightOffset;
        if (!user?.id || !token) return null;
        return (
          <ChatWindow
            key={friend.id}
            friend={friend}
            onClose={() => handleCloseChat(friend.id)}
            initialRightOffset={rightPosition}
            onDragEnd={handleChatWindowDragEnd}
            socket={socket}
            currentUser={user}
            currentToken={token}
          />
        );
      })}
    </>
  );
}
