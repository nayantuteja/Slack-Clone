import React, { useState, useEffect, useCallback, useRef } from "react";
import io from "socket.io-client";
import Peer from "peerjs";
import usePeer from "../hooks/usePeer";

const ChatWindow = (userid) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [catcherId, setCatcherId] = useState("");
  const [userId, setUserId] = useState(null);
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState({});
  const [inputMessage, setInputMessage] = useState("");
  const [activeChat, setActiveChat] = useState("employer");
  const [selectedUser, setSelectedUser] = useState(null);
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedUsersForGroup, setSelectedUsersForGroup] = useState({});
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [employerRoom, setEmployerRoom] = useState(null);

  const [peerId, setPeerId] = useState(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const peerInstance = useRef(null);
  const [useroncall, setUserOnCall]=useState(null);

  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showRemoveUserModal, setShowRemoveUserModal] = useState(false);

  const [userIdToAdd, setUserIdToAdd] = useState('');
  const [userIdToRemove, setUserIdToRemove] = useState('');

  const [usersInSelectedGroup, setUsersInSelectedGroup] = useState([]);
  const [usersNotInSelectedGroup, setUsersNotInSelectedGroup] = useState([]);

  const { peer, myId } = usePeer();


  useEffect(() => {
    const newSocket = io("https://slack-clone-yxgl.onrender.com");
    setSocket(newSocket);
    newSocket.on("connect", () => setIsConnected(true));
    newSocket.on("disconnect", () =>{ 
    setIsConnected(false)
    setUserId(null);

  });
    return () => newSocket.close();
  }, []);
  useEffect(()=>{
    console.log("user", userid)
    login();
  },[userid])
  const login = () => {
    if ( socket&&userid) {
      console.log("catcherid", userid.userid);
      socket.emit("login", userid.userid);
    }
  };

  useEffect(() => {
    if (!socket || !peer) return;

    const handleMessage = (msg) => {
      setMessages((prevMessages) => {
        const chatId = msg.chatId;
        if (prevMessages[chatId]?.some((existingMsg) => existingMsg.id === msg.id)) {
          return prevMessages;
        }
        return {
          ...prevMessages,
          [chatId]: [...(prevMessages[chatId] || []), msg],
        };
      });
    };

    socket.on("user list", (userList) => {
      setUsers(userList);
    });

    socket.on("sub-employee joined", (subEmployee) => {
      setUsers((prevUsers) => [...prevUsers, subEmployee]);
    });
    socket.on('group updated', (updatedGroupDetails) => {
      //console.log("updategroupdetails",updatedGroupDetails)
      setGroups((prevGroups) => {
        const groupIndex = prevGroups.findIndex((g) => g.id === updatedGroupDetails.id);
        if (groupIndex !== -1) {
          // Update existing group
          const newGroups = [...prevGroups];
          newGroups[groupIndex] = updatedGroupDetails;
          return newGroups;
        } else {
          // Add new group if it doesn't exist
          return [...prevGroups, updatedGroupDetails];
        }
      });

      // Update users lists if the updated group is the currently selected group
      if (selectedGroup && selectedGroup.id === updatedGroupDetails.id) {
        setUsersInSelectedGroup(updatedGroupDetails.usersInGroup);
        setUsersNotInSelectedGroup(updatedGroupDetails.usersNotInGroup);
      }
    });
    socket.on('user removed from group', (groupId) => {
      setGroups((prevGroups) => prevGroups.filter((group) => group.id !== groupId));
      if (selectedGroup?.id === groupId) {
        setSelectedGroup(null);
        setActiveChat('private');
      }
    });
    socket.on('removed from group', (groupId) => {
      console.log("i am removed from",groupId,selectedGroup)
      setGroups(prevGroups => prevGroups.filter(group => group.id !== groupId));
      // setSelectedGroup(null);
      
      // console.log("i am removed from 2.0",groupId,selectedGroup.id)
      if (selectedGroup && selectedGroup.id === groupId) {
        setSelectedGroup(null);
        setActiveChat('private');
      }
    });
    socket.on('added to group', (newGroup) => {
      setGroups((prevGroups) => {
        if (!prevGroups.some((g) => g.id === newGroup.id)) {
          return [...prevGroups, newGroup];
        }
        return prevGroups;
      });
    });

    socket.on('group details', (groupDetails) => {
      //console.log('Received group details:', groupDetails);
 
      // Validate the data to ensure arrays are not empty or undefined
      if (!groupDetails || !Array.isArray(groupDetails.usersInGroup) || !Array.isArray(groupDetails.usersNotInGroup)) {
        console.error('Invalid group details received:', groupDetails);
        setUsersInSelectedGroup([]);
        setUsersNotInSelectedGroup([]);
        return;
      }
 
      // Set the state with validated data
      setUsersInSelectedGroup(groupDetails.usersInGroup);
      setUsersNotInSelectedGroup(groupDetails.usersNotInGroup);
 
      // Additional logging for debugging
      // console.log('Users in group:', groupDetails.usersInGroup);
      // console.log('Users not in group:', groupDetails.usersNotInGroup);
    });

    socket.on("chat message", handleMessage);
    socket.on("chat history", (history) => {
      setMessages((prevMessages) => ({
        ...prevMessages,
        [history[0]?.chatId]: history,
      }));
    });

    socket.on("login successful", ({ user, usersWithSameParent, chatHistory }) => {
      setUserId(user.id);
      setIsConnected(true);
      setEmployerRoom(`employer-${user.parentId}`);
      setUsers(usersWithSameParent);

      const organizedHistory = chatHistory.reduce((acc, msg) => {
        if (!acc[msg.chatId]) {
          acc[msg.chatId] = [];
        }
        acc[msg.chatId].push(msg);
        return acc;
      }, {});

      setMessages(organizedHistory);
    });

    socket.on("login failed", (error) => {
      console.error("Login failed:", error);
    });

    socket.on("user joined", (user) => setUsers((prevUsers) => [...prevUsers, user]));
    socket.on("user left", (userId) => setUsers((prevUsers) => prevUsers.filter((user) => user.id !== userId)));
    socket.on("group created", (group) => setGroups((prevGroups) => [...prevGroups, group]));
    socket.on("group list", setGroups);

    socket.on("incoming-call", handleIncomingCall);
    socket.on("call-ended", handleCallEnded);
    socket.on("check-call",handlecheckcall);

    peer.on("call", handleIncomingPeerCall);

    return () => {
      socket.off("chat message", handleMessage);
      socket.off("login successful");
      socket.off("login failed");
      socket.off("user list");
      socket.off("user joined");
      socket.off("user left");
      socket.off("group created");
      socket.off("group list");
      socket.off("sub-employee joined");
      socket.off("incoming-call", handleIncomingCall);
      socket.off("call-ended", handleCallEnded);
      socket.off("removed from group");
    };
  }, [socket, peer,selectedGroup,userId,usersNotInSelectedGroup]);
  

  
  const startCall = useCallback(async () => {
    check()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setLocalStream(stream);

      const call = peer.call(selectedUser.id, stream);
      call.on("stream", handleStream);
      
      socket.emit("call-user", {
        useroncall: useroncall,
        signalData: myId,
      });

      setIsCallActive(true);
    } catch (error) {
      console.error("Error starting call:", error);
    }
  }, [selectedUser, socket, myId, peer, useroncall]);
  
  const handleIncomingCall = useCallback((data) => {
    if (useroncall || localStream) {
      socket.emit("user-in-call");
      return;
    }
    setIncomingCall(data);
    setUserOnCall(data.useroncall);
  }, [useroncall, localStream, socket]);

  const handleIncomingPeerCall = useCallback(async (call) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setLocalStream(stream);
      call.answer(stream);
      call.on("stream", handleStream);
      setIsCallActive(true);
    } catch (error) {
      console.error("Error accepting call:", error);
    }
  }, []);

  const acceptCall = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setLocalStream(stream);

      const call = peer.call(incomingCall.signal, stream);
      call.on("stream", handleStream);

      socket.emit("answer-call", { signal: myId, to: incomingCall.from });
      setIsCallActive(true);
      setIncomingCall(null);
    } catch (error) {
      console.error("Error accepting call:", error);
    }
  }, [incomingCall, socket, myId, peer]);

  const handleStream = useCallback((remoteStream) => {
    setRemoteStream(remoteStream);
  }, []);

  const endCall = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    setLocalStream(null);
    setRemoteStream(null);
    setIsCallActive(false);
    
    socket.emit("end-call", useroncall.id);
    console.log("select",selectedUser);
    //setUserOnCall(null);
  }, [localStream, socket, useroncall]);

  const handleCallEnded = useCallback(() => {
    console.log("selecteduser", selectedUser);
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    if (remoteStream) {
      remoteStream.getTracks().forEach((track) => track.stop());
    }
  
    setLocalStream(null);
    setRemoteStream(null);
    setIsCallActive(false);
    //setUserOnCall(null);
  }, [localStream, remoteStream]);
  
  const check=()=>{
    socket.emit("check-available",{
      useroncall: useroncall,
      signalData: peerId,
    })
  }
  const handlereponsefinal=(data)=>{
    console.log("dataaaaaaaa",data);
    startCall();
  }
  const calldeclined=()=>{
    setIncomingCall(null);
    console.log("useroncall", useroncall);
    endCall();
  }

  const handlecheckcall=useCallback((data)=>{
    console.log("remotestream-localstream",isCallActive,data)
    //socket.emit ("response", data);
  },[isCallActive]);  

  const addUserToGroup = useCallback((userIdToAdd) => {
    if (socket && selectedGroup) {
      socket.emit('add to group', { groupId: selectedGroup.id, userId: userIdToAdd });
    }
  }, [socket, selectedGroup]);

  // Update the removeUserFromGroup function
  const removeUserFromGroup = useCallback((userIdToRemove) => {
    if (socket && selectedGroup) {
      socket.emit('remove from group', { groupId: selectedGroup.id, userId: userIdToRemove });
      if (userIdToRemove === userId) {
        // If the user is removing themselves, update the UI immediately
        setGroups(prevGroups => prevGroups.filter(group => group.id !== selectedGroup.id));
        setSelectedGroup(null);
        setActiveChat('private');
      }
    }
  }, [socket, selectedGroup, userId]);

  const getChatId = (user1, user2) => {
    return [user1, user2].sort().join("-");
  };

  useEffect(() => {
    console.log("remote stream", remoteStream,localStream);
  }, [remoteStream]);

  const sendMessage = useCallback(() => {
    if (inputMessage.trim() !== "" && socket) {
      const messageData = {
        id: Date.now().toString(),
        text: inputMessage,
        sender: userId,
        chatId:
          activeChat === "private"
            ? getChatId(userId, selectedUser?.id)
            : activeChat === "group"
            ? `group-${selectedGroup?.id}`
            : employerRoom,
        receiver: activeChat === "private" ? selectedUser?.id : undefined,
      };

      socket.emit("chat message", messageData);

      setMessages((prevMessages) => ({
        ...prevMessages,
        [messageData.chatId]: [
          ...(prevMessages[messageData.chatId] || []),
          messageData,
        ],
      }));

      setInputMessage("");
    }
  }, [
    socket,
    inputMessage,
    activeChat,
    selectedUser,
    selectedGroup,
    userId,
    employerRoom,
  ]);

  const selectUser = (user) => {
    setSelectedUser(user);
    if(!useroncall){
      setUserOnCall(user);
    }
    setActiveChat("private");
    setSelectedGroup(null);
    const chatId = getChatId(userId, user.id);
    socket.emit("fetch chat history", chatId);
  };

  const selectGroup = (group) => {
    console.log("selectedgroup", group);
    setSelectedGroup(group);
    setActiveChat("group");
    setSelectedUser(null);
    const chatId = `group-${group.id}`;
    socket.emit("fetch chat history", chatId);
    socket.emit('fetch group details', group.id);
  };

  const createGroup = useCallback(() => {
    if (newGroupName.trim() !== "" && socket) {
      const members = Object.keys(selectedUsersForGroup).filter(
        (id) => selectedUsersForGroup[id]
      );
      const newGroup = {
        name: newGroupName,
        members: [...members, userId],
      };
      socket.emit("create group", newGroup);
      setNewGroupName("");
      setSelectedUsersForGroup({});
      setShowCreateGroupModal(false);
    }
  }, [socket, newGroupName, selectedUsersForGroup, userId]);

  const toggleUserForGroup = (userId) => {
    setSelectedUsersForGroup((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };
  const currentChatId =
    activeChat === "private" && selectedUser
      ? getChatId(userId, selectedUser.id)
      : activeChat === "group" && selectedGroup
      ? `group-${selectedGroup.id}`
      : employerRoom;

  const currentMessages = currentChatId ? messages[currentChatId] || [] : [];

  // useEffect(()=>{
  //   console.log("sleevctede group val", selectedGroup);
  // },[selectedGroup])
  // ... (rest of the component logic remains the same)

  // if (!isConnected || !userId) {
  //   return (
  //     <div className="flex items-center justify-center h-screen">
  //       <div className="w-64">
  //         <input
  //           type="text"
  //           value={catcherId}
  //           onChange={(e) => setCatcherId(e.target.value)}
  //           placeholder="Enter your Catcher ID"
  //           className="w-full px-3 py-2 border rounded mb-4"
  //         />
  //         <button
  //           onClick={login}
  //           className="w-full bg-blue-500 text-white px-4 py-2 rounded"
  //         >
  //           Login
  //         </button>
  //       </div>
  //     </div>
  //   );
  // }
  const renderAddUserModal = () => {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
        <div className="bg-white p-4 rounded">
          <h2 className="text-lg font-semibold mb-2">Add User to Group</h2>
          {usersNotInSelectedGroup.length === 0 ? (
            <p className="text-red-500">No users available to add to the group.</p>
          ) : (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700">Select User to Add:</label>
              <select
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                onChange={(e) => setUserIdToAdd(e.target.value)}
                value={userIdToAdd}
              >
                <option value="">Select a user</option>
                {usersNotInSelectedGroup.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.username}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button
            onClick={() => {
              if (userIdToAdd) {
                addUserToGroup(userIdToAdd);
              } else {
                console.warn('No user selected to add.');
              }
              setShowAddUserModal(false);
              setUserIdToAdd('');
            }}
            className="mt-2 px-4 py-2 bg-green-500 text-white rounded"
            disabled={!userIdToAdd}
          >
            Add User
          </button>
          <button
            onClick={() => {
              setShowAddUserModal(false);
              setUserIdToAdd('');
            }}
            className="mt-2 px-4 py-2 bg-gray-200 rounded"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  };
 

  // Render the remove user modal
  const renderRemoveUserModal = () => {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
        <div className="bg-white p-4 rounded">
          <h2 className="text-lg font-semibold mb-2">Remove User from Group</h2>
          {usersInSelectedGroup.length === 0 ? (
            <p className="text-red-500">No users available to remove from the group.</p>
          ) : (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700">Select User to Remove:</label>
              <select
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                onChange={(e) => setUserIdToRemove(e.target.value)}
                value={userIdToRemove}
              >
                <option value="">Select a user</option>
                {usersInSelectedGroup.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.username}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button
            onClick={() => {
              if (userIdToRemove) {
                removeUserFromGroup(userIdToRemove);
              } else {
                console.warn('No user selected to remove.');
              }
              setShowRemoveUserModal(false);
              setUserIdToRemove('');
            }}
            className="mt-2 px-4 py-2 bg-red-500 text-white rounded"
            disabled={!userIdToRemove}
          >
            Remove User
          </button>
          <button
            onClick={() => {
              setShowRemoveUserModal(false);
              setUserIdToRemove('');
            }}
            className="mt-2 px-4 py-2 bg-gray-200 rounded"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  };
 


  return (
    <div className="flex h-screen max-w-4xl mx-auto p-4">
      {/* {selectedUser && (
        <div className="mt-4">
          {!isCallActive && (
            <button
              onClick={startCall}
              className="bg-green-500 text-white px-4 py-2 rounded mr-2"
            >
              Start Voice Call
            </button>
          )}
          {isCallActive && (
            <button
              onClick={endCall}
              className="bg-red-500 text-white px-4 py-2 rounded"
            >
              End Call
            </button>
          )}
        </div>
      )} */}

      {incomingCall && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-4 rounded">
            <h2 className="text-lg font-semibold mb-2">Incoming Call</h2>
            <p>
              {users.find((u) => u.id === incomingCall.from)?.username} is
              calling you.
            </p>
            <div className="mt-4 flex justify-end">
              <button
                onClick={calldeclined}
                className="bg-red-500 text-white px-4 py-2 rounded mr-2"
              >
                Decline
              </button>
              <button
                onClick={acceptCall}
                className="bg-green-500 text-white px-4 py-2 rounded"
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-1/3 mr-4">
        <div className="mb-4">
          <button
            className={`px-4 py-2 mr-2 ${
              activeChat === "private"
                ? "bg-blue-500 text-white"
                : "bg-gray-200"
            }`}
            onClick={() => setActiveChat("private")}
          >
            Users
          </button>
          <button
            className={`px-4 py-2 mr-2 ${
              activeChat === "group" ? "bg-blue-500 text-white" : "bg-gray-200"
            }`}
            onClick={() => setActiveChat("group")}
          >
            Groups
          </button>
          {/* <button
            className={`px-4 py-2 ${activeChat === 'employer' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            onClick={() => setActiveChat('employer')}
          >
            Employer Room
          </button> */}
        </div>

        {activeChat === "private" && (
          <div>
            <h2 className="text-lg font-semibold mb-2">Users</h2>
            <div className="h-64 border rounded p-2 overflow-y-auto">
              {users
                .filter((user) => user.id !== userId)
                .map((user) => (
                  <div
                    key={user.id}
                    className={`flex items-center p-2 cursor-pointer hover:bg-gray-100 ${
                      selectedUser?.id === user.id ? "bg-gray-200" : ""
                    }`}
                    onClick={() => selectUser(user)}
                  >
                    <span>
                      {user.username} ({user.userType})
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {activeChat === "group" && (
          <div>
            <h2 className="text-lg font-semibold mb-2">Groups</h2>
            <div className="h-48 border rounded p-2 mb-2 overflow-y-auto">
              {groups.map((group) => (
                <div
                  key={group.id}
                  className={`p-2 cursor-pointer hover:bg-gray-100 ${
                    selectedGroup?.id === group.id ? "bg-gray-200" : ""
                  }`}
                  onClick={() => selectGroup(group)}
                >
                  {group.name}
                </div>
              ))}
            </div>
            <button
              className="w-full bg-blue-500 text-white px-4 py-2 rounded"
              onClick={() => setShowCreateGroupModal(true)}
            >
              Create New Group
            </button>
            {selectedGroup?.createdBy === userId && (
              <div className="flex space-x-2 mb-2">
                <button
                  className="px-4 py-2 bg-green-500 text-white rounded"
                  onClick={() => setShowAddUserModal(true)}
                >
                  Add User
                </button>
                <button
                  className="px-4 py-2 bg-red-500 text-white rounded"
                  onClick={() => setShowRemoveUserModal(true)}
                >
                  Remove User
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col w-2/3">
        <div className="flex flex-row ">
          <h2 className="text-lg font-semibold mb-2">
            {activeChat === "private" && selectedUser
              ? `Chat with ${selectedUser.username}`
              : activeChat === "group" && selectedGroup
              ? `Group: ${selectedGroup.name}`
              : activeChat === "employer"
              ? "Employer Room"
              : "Select a user, group, or room to chat"}
          </h2>

          
            <div className="mt-4">
            {
              !isCallActive ?(
                selectedUser&& (
                  <button
                    onClick={startCall}
                    className="bg-green-500 text-white px-4 py-2 rounded mr-2"
                  >
                    Start Voice Call
                  </button>
                )

              ):(
               useroncall&& (
                  <button
                    onClick={endCall}
                    className="bg-red-500 text-white px-4 py-2 rounded"
                  >
                    End Call
                  </button>
                )
              )
            }
              
              
            </div>
      
          {isCallActive && (
            <div className="mt-4  flex flex-col">
              <p className="h-[10px]">Call in progress with  </p>
              <audio
                ref={(audio) => {
                  if (audio && remoteStream) {
                    audio.srcObject = remoteStream;
                    audio.play();
                  }
                }}
              />
            </div>
          )}
        </div>

        <div className="flex-grow mb-4 border rounded p-2 overflow-y-auto">
          {currentMessages.map((message, index) => (
            <div
              key={index}
              className={`mb-2 ${
                message.sender === userId ? "text-right" : "text-left"
              }`}
            >
              <span className="font-bold">
                {message.sender === userId
                  ? "You"
                  : users.find((u) => u.id === message.sender)?.username}
                :
              </span>{" "}
              {message.text}
            </div>
          ))}
        </div>

        <div className="flex">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-grow mr-2 px-2 py-1 border rounded"
          />
          <button
            onClick={sendMessage}
            className="bg-blue-500 text-white px-4 py-2 rounded"
          >
            Send
          </button>
        </div>
      </div>

      {showCreateGroupModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-4 rounded">
            <h2 className="text-lg font-semibold mb-2">Create a New Group</h2>
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Group Name"
              className="w-full px-2 py-1 border rounded mb-4"
            />
            <div className="mb-4">
              <h3 className="mb-2 font-semibold">Select Users:</h3>
              {users
                .filter((user) => user.id !== userId)
                .map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center space-x-2 mb-2"
                  >
                    <input
                      type="checkbox"
                      id={`user-${user.id}`}
                      checked={selectedUsersForGroup[user.id] || false}
                      onChange={() => toggleUserForGroup(user.id)}
                    />
                    <label htmlFor={`user-${user.id}`}>{user.username}</label>
                  </div>
                ))}
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setShowCreateGroupModal(false)}
                className="mr-2 px-4 py-2 bg-gray-200 rounded"
              >
                Cancel
              </button>
              <button
                onClick={createGroup}
                className="px-4 py-2 bg-blue-500 text-white rounded"
              >
                Create Group
              </button>
            </div>
          </div>
        </div>
      )}
      {showAddUserModal && renderAddUserModal()}
      {showRemoveUserModal && renderRemoveUserModal()}
    </div>
  );
};

export default ChatWindow;
