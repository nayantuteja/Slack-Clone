import React, { useState, useEffect, useCallback, useRef } from "react";
import io from "socket.io-client";
import Peer from "peerjs";
import usePeer from "../hooks/usePeer";

const ChatWindow = (userid) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  //const [catcherId, setCatcherId] = useState("");
  const [userId, setUserId] = useState(null);
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState({});
  //const [inputMessage, setInputMessage] = useState("");
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
  const [groupstreams, setGroupStreams] = useState([]);
  //const peerInstance = useRef(null);
  const [useroncall, setUserOnCall] = useState(null);

  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showRemoveUserModal, setShowRemoveUserModal] = useState(false);

  const [userIdToAdd, setUserIdToAdd] = useState("");
  const [userIdToRemove, setUserIdToRemove] = useState("");

  const [usersInSelectedGroup, setUsersInSelectedGroup] = useState([]);
  const [usersNotInSelectedGroup, setUsersNotInSelectedGroup] = useState([]);

  const { peer, myId } = usePeer();

  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [viewingImage, setViewingImage] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [originalSize, setOriginalSize] = useState({ width: 0, height: 0 });
  const [maxZoom, setMaxZoom] = useState(2);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const contentEditableRef = useRef(null);
  const imageRef = useRef(null);
  const [isHolding, setIsHolding] = useState(false);
  const [dragStartPoint, setDragStartPoint] = useState({ x: 0, y: 0 });
  const [imageDragging, setImageDragging] = useState(false);
  const [usersoncall, setUsersOnCall] = useState([]);
  const [incominggroupcall, setIncomingGroupCall] = useState();
  const [ongroupcall, setOnGroupCall] = useState(false);
  const [groupdata, setGroupData] = useState();
  const [oncallgroup, setOnCallGroup] = useState();

  const [searchQuery, setSearchQuery] = useState(""); // Search query
  const [searchResults, setSearchResults] = useState([]); // Array to hold matched message indices
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0); // Currently displayed search result
  const [filteredMessages, setFilteredMessages] = useState([]); // To display only search result messages
  const [userSearchQuery, setUserSearchQuery] = useState(""); // Search query for users
  const [groupSearchQuery, setGroupSearchQuery] = useState(""); // Search query for groups
  const isCallActiveRef = useRef(isCallActive);
  const localStreamRef= useRef(localStream);


  const formatDate = (dateValue) => {
    if (!dateValue) return 'N/A';
    const date = new Date(dateValue);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const formatTime = (dateValue) => {
    if (!dateValue) return 'N/A';
    const date = new Date(dateValue);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const shouldShowDateHeader = (currentMsg, prevMsg) => {
    if (!prevMsg) return true;
    const currentDate = new Date(currentMsg.createdAt).toDateString();
    const prevDate = new Date(prevMsg.createdAt).toDateString();
    return currentDate !== prevDate;
  };



  const filteredUsers = users.filter((user) =>
    user.username.toLowerCase().includes(userSearchQuery.toLowerCase())
  );

  const filteredGroups = groups.filter((group) =>
    group.name.toLowerCase().includes(groupSearchQuery.toLowerCase())
  );

  const clearSearch = () => {
    setSearchQuery("");           // Clear the search input
    setSearchResults([]);         // Clear the search results
    setCurrentSearchIndex(0);     // Reset the search index
    setFilteredMessages([]);      // Reset filtered messages
  };
  const handleSearch = (e) => {
    e.preventDefault();
   
    if (!searchQuery) {
      setSearchResults([]); // Clear results if the query is empty
      return;
    }
   
    // Get the indices of matched messages in currentMessages
    const results = currentMessages
      .map((msg, index) => {
        // Extract text content even if the message contains an image
        const textContent = extractTextContent(msg.text);
        return textContent.toLowerCase().includes(searchQuery.toLowerCase()) ? index : -1;
      })
      .filter(index => index !== -1);
   
    // Reverse the results to show the latest message first
    const reversedResults = results.reverse();
    setSearchResults(reversedResults); // Store the indices of matched messages
    setCurrentSearchIndex(0);  // Start from the first matched message (which is now the latest)
   
    // If there are results, scroll to the first matched message (latest one)
    if (reversedResults.length > 0) {
      scrollToMessage(reversedResults[0]); // Scroll to the first matched message (latest)
    }
  };
   
   
  // Function to extract text content from a message, even if it contains an image
  const extractTextContent = (text) => {
    if (!text) return '';
   
    // Remove base64 image data
    const withoutBase64 = text.replace(/data:image\/[a-zA-Z]+;base64,[A-Za-z0-9+/=]+/g, '');
   
    // Remove <img> tags
    const withoutImgTags = withoutBase64.replace(/<img\s[^>]*>/g, '');
   
    // Trim any resulting whitespace
    return withoutImgTags.trim();
  };
   


  const goToNextResult = () => {
    if (searchResults.length > 0) {
      const nextIndex = (currentSearchIndex + 1) % searchResults.length;
      setCurrentSearchIndex(nextIndex);
      const nextMessageIndex = searchResults[nextIndex];
      setFilteredMessages([currentMessages[nextMessageIndex]]); // Display the next matched message
      scrollToMessage(nextMessageIndex);
    }
  };

  const goToPreviousResult = () => {
    if (searchResults.length > 0) {
      const prevIndex = (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
      setCurrentSearchIndex(prevIndex);
      const prevMessageIndex = searchResults[prevIndex];
      setFilteredMessages([currentMessages[prevMessageIndex]]); // Display the previous matched message
      scrollToMessage(prevMessageIndex);
    }
  };



  const scrollToMessage = (index) => {
    const messageElement = document.getElementById(`message-${index}`);
    if (messageElement) {
      messageElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  };
  useEffect(() => {
 
    setSearchQuery("");    
    setSearchResults([]);      
    setCurrentSearchIndex(0);    
    setFilteredMessages([]);      
}, [selectedUser, selectedGroup]);

  useEffect(() => {
    //console.log("1")
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    //console.log("Mobile", isMobile);
    setMaxZoom(isMobile ? 10 : 2);
  }, []);

  useEffect(() => {
    // Centers the image when it is viewed and adjusts the position on window resize.
    //console.log("3")
    if (viewingImage) {
      const handleResize = () => {
        //console.log("chalaaa")
        if (imageRef.current) {
          // check if the image element is available
          // imgRect will be an object containing properties like width and height.
          const imgRect = imageRef.current.getBoundingClientRect(); //getBoundingClientRect() provides the size of the image and its position relative to the viewport.
          const viewportWidth = window.innerWidth;
          const viewportHeight = window.innerHeight;
          const imgWidth = imgRect.width;
          const imgHeight = imgRect.height;
          // console.log("check", viewportWidth, viewportHeight)
          // console.log("check2", imgWidth, imgHeight)
          // console.log("container pos x, y", (viewportWidth - imgWidth) / 2, (viewportHeight - imgHeight) / 2)
          // console.log("container pos x, y", (viewportWidth - imgWidth), (viewportHeight - imgHeight))
          setImagePosition({
            // Calculate initial position to center the image
            x: (viewportWidth - imgWidth) / 2,
            y: (viewportHeight - imgHeight) / 2,
          });
        }
      };
      handleResize();
      window.addEventListener("resize", handleResize);
      return () => {
        window.removeEventListener("resize", handleResize);
      };
    }
  }, [viewingImage]);

  useEffect(() => {
    //console.log("4")
    const handleScroll = (e) => {
      if (viewingImage) {
        e.preventDefault();
        const zoomChange = e.deltaY < 0 ? 1.1 : 0.9; // for virtical scroll direction if scroll up increase by 1.1 zoom in and scroll sown with 0.9 zoom out
        setZoom((prevZoom) => {
          const newZoom = Math.max(1, Math.min(prevZoom * zoomChange, maxZoom)); // prevzoom is current zoom level it will not go below 1 and above the maxZoom
          return newZoom;
        });
      }
    };

    window.addEventListener("wheel", handleScroll); // calls the handlescroll when the wheel is moved
    return () => {
      window.removeEventListener("wheel", handleScroll);
    };
  }, [viewingImage, maxZoom]);

  const insertImageIntoContentEditable = (imageUrl) => {
    if (contentEditableRef.current) {
      const img = document.createElement("img");
      img.src = imageUrl;
      img.style.maxWidth = "100%";
      img.style.maxHeight = "150px";
      img.style.paddingTop = "2px"; // Add padding to the top
      img.style.paddingBottom = "2px"; // Add padding to the bottom
      // img.style.cursor = "pointer";
      // img.onclick = () => {
      //     setViewingImage(imageUrl);
      //     setZoom(1);
      // };

      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(contentEditableRef.current);
      range.collapse(false);
      range.insertNode(img);
      range.setStartAfter(img); // Move the cursor after the image
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      contentEditableRef.current.focus(); // Focus the contentEditable element
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const newImages = [...images, ...files]; // creates a array of existing image and newly dropped files
      setImages(newImages);
      const readers = files.map((file) => {
        const reader = new FileReader();
        return new Promise((resolve) => {
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(file);
        });
      });

      Promise.all(readers).then((previews) => {
        setImagePreviews([...imagePreviews, ...previews]);
        previews.forEach((preview) => insertImageIntoContentEditable(preview)); //ittrates over the perview anf insert each emage into the contentEditable div
      });
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleImageLoad = (e) => {
    const { naturalWidth, naturalHeight } = e.target;
    setOriginalSize({ width: naturalWidth, height: naturalHeight });
  };

  // we wala
  const handleContentChange = (e) => {
    const contentEditableElement = e.currentTarget;
    const selection = window.getSelection();
    const range =
      selection.rangeCount > 0
        ? selection.getRangeAt(0)
        : document.createRange();

    // Save the current cursor position
    const cursorPosition = {
      offset: range.startOffset,
      container: range.startContainer,
    };

    // Function to color URLs in the text
    const colorUrls = (text) => {
      const urlRegex = /https:\/\/([^\/\.]+)\.([^\/\s]+(?:\/[^\s]*)?)/gi;
      return text;
    };

    const processNodes = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        // Replace text content with colored URLs
        const newTextContent = colorUrls(node.textContent);
        if (newTextContent !== node.textContent) {
          // Replace text node with a new span containing the formatted text
          const newSpan = document.createElement("span");
          newSpan.innerHTML = newTextContent;
          node.replaceWith(...newSpan.childNodes);
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.nodeName === "IMG") {
          // Do nothing, preserve <img> tags as HTML
          return;
        } else {
          // Convert element's content to plain text
          const plainText = node.innerText;

          // Process the plain text to color URLs
          const coloredText = colorUrls(plainText);

          // Replace the element with a new text node containing the colored text
          const newTextNode = document.createTextNode(coloredText);
          node.replaceWith(newTextNode);
        }
      }
    };

    // Process the content without replacing the entire innerHTML
    // [Text, Img, text, <div><span>text</span></div>]
    Array.from(contentEditableElement.childNodes).forEach(processNodes);

    // Restore cursor position
    const restoreCursor = () => {
      const newRange = document.createRange();
      newRange.setStart(cursorPosition.container, cursorPosition.offset);
      newRange.collapse(true);

      selection.removeAllRanges();
      selection.addRange(newRange);
    };

    restoreCursor();
  };

  const handleFiles = (files) => {
    const imageFiles = Array.from(files).filter((file) =>
      file.type.startsWith("image/")
    ); // chechks the MIME type that starts with '/image"

    if (imageFiles.length === 0) {
      console.log("No valid image files selected");
      return;
    }

    const newImages = [...images, ...imageFiles];
    setImages(newImages);

    const readers = imageFiles.map((file) => {
      const reader = new FileReader();
      return new Promise((resolve) => {
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });
    });

    Promise.all(readers).then((previews) => {
      setImagePreviews([...imagePreviews, ...previews]);
      previews.forEach((preview) => insertImageIntoContentEditable(preview));
    });
  };

  const handlePaste = (e) => {
    const items = e.clipboardData.items;
    const files = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        files.push(file);
      }
    }
    if (files.length > 0) {
      handleFiles(files);
      e.preventDefault(); // Prevent the default paste behavior
      contentEditableRef.current.focus();
    }
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    handleFiles(files);
  };

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsHolding(true);
    setDragStartPoint({ x: e.clientX, y: e.clientY });
    setImageDragging(false);
    //console.log("Hold chexk", isHolding)
  };

  const handleMouseMove = (e) => {
    if (!isHolding) return;
    //console.log("holding check agian", isHolding)

    const dx = e.clientX - dragStartPoint.x;
    const dy = e.clientY - dragStartPoint.y;

    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      setImageDragging(true);
    }

    if (imageDragging) {
      setImagePosition((prevPosition) => ({
        x: prevPosition.x + dx,
        y: prevPosition.y + dy,
      }));
      setDragStartPoint({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    //console.log("working")
    if (isHolding && !imageDragging) {
      // This was a click, not a drag
      setZoom(1);
    }
    setIsHolding(false);
    setImageDragging(true);
  };

  useEffect(() => {
    // Add global event listeners
    // window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    // Cleanup function to remove event listeners
    return () => {
      // window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isHolding, imageDragging]); // Dependencies for the effect

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      // Prevent the default action for Enter key (adding a new line)
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleImageClick = useCallback((src) => {
    setViewingImage(src);
    setZoom(1);
  }, []);

  const renderMessage = (text, images) => {
    const urlPattern =
      /\b(?:https?|ftp|file):\/\/[^\s<>"'()]+(?=\s|$|(?=<))|(?<![\w.-])www\.[^\s<>"'()]+(?=\s|$|(?=<))/gi;
    let parts = [];
    let lastIndex = 0;
    let match;

    const processImageTags = (html) => {
      return html.replace(
        /<img\s([^>]*?)src=["']([^"']*)["']([^>]*?)>/gi,
        (match, p1, src, p2) => {
          return `<img ${p1}src="${src}"${p2} style="display:block;cursor:pointer;max-width:100%;max-height:150px;" data-clickable-image="${src}" />`;
        }
      );
    };

    while ((match = urlPattern.exec(text)) !== null) {
      const url = match[0];
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      const href = url.startsWith("www.") ? `http://${url}` : url;
      parts.push(
        <a
          key={url}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "blue", textDecoration: "underline" }}
        >
          {url}
        </a>
      );
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return (
      <div
        onClick={(e) => {
          const clickedImage = e.target.closest("[data-clickable-image]");
          if (clickedImage) {
            handleImageClick(clickedImage.getAttribute("data-clickable-image"));
          }
        }}
      >
        {parts.map((part, index) => {
          if (typeof part === "string" && !urlPattern.test(part)) {
            const htmlWithProcessedImages = processImageTags(part);
            return (
              <span
                key={index}
                dangerouslySetInnerHTML={{ __html: htmlWithProcessedImages }}
              />
            );
          } else {
            return part;
          }
        })}
      </div>
    );
  };

  // useEffect(() => {
  //   console.log('Connection status changed:', isConnected);
  //   console.log('User ID:', userId);
  // }, [isConnected, userId]);
  // useEffect(()=>{
  //   //console.log("userid", userid)
  // },[userid])
  useEffect(() => {
    const newSocket = io("https://slack-clone-yxgl.onrender.com");
    setSocket(newSocket);
    newSocket.on("connect", () => setIsConnected(true));
    newSocket.on("disconnect", () => {
      setIsConnected(false);
      setUserId(null);
    });
  }, []);
  useEffect(() => {
    //console.log("user", userid)
    login();
  }, [userid]);
  const login = () => {
    if (socket && userid) {
      //console.log("catcherid", userid.userid);
      socket.emit("login", userid.userid);
    }
  };

  useEffect(() => {
    if (!socket || !peer) return;

    const handleMessage = (msg) => {
      setMessages((prevMessages) => {
        const chatId = msg.chatId;
        if (
          prevMessages[chatId]?.some((existingMsg) => existingMsg.id === msg.id)
        ) {
          return prevMessages;
        }
        return {
          ...prevMessages,
          [chatId]: [...(prevMessages[chatId] || []), msg],
        };
      });
    };

    socket.on("user list", (userList) => {
      //console.log("userlist",userList);
      setUsers(userList);
    });

    socket.on("sub-employee joined", (subEmployee) => {
      setUsers((prevUsers) => [...prevUsers, subEmployee]);
    });
    socket.on("group updated", (updatedGroupDetails) => {
      //console.log("updategroupdetails",updatedGroupDetails)
      setGroups((prevGroups) => {
        const groupIndex = prevGroups.findIndex(
          (g) => g.id === updatedGroupDetails.id
        );
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
    socket.on("user removed from group", (groupId) => {
      setGroups((prevGroups) =>
        prevGroups.filter((group) => group.id !== groupId)
      );
      if (selectedGroup?.id === groupId) {
        setSelectedGroup(null);
        setActiveChat("private");
      }
    });
    socket.on("removed from group", (groupId) => {
      //console.log("i am removed from",groupId,selectedGroup)
      setGroups((prevGroups) =>
        prevGroups.filter((group) => group.id !== groupId)
      );
      // setSelectedGroup(null);

      // console.log("i am removed from 2.0",groupId,selectedGroup.id)
      if (selectedGroup && selectedGroup.id === groupId) {
        setSelectedGroup(null);
        setActiveChat("private");
      }
    });
    socket.on("added to group", (newGroup) => {
      setGroups((prevGroups) => {
        if (!prevGroups.some((g) => g.id === newGroup.id)) {
          return [...prevGroups, newGroup];
        }
        return prevGroups;
      });
    });

    socket.on("group details", (groupDetails) => {
      //console.log('Received group details:', groupDetails);

      // Validate the data to ensure arrays are not empty or undefined
      if (
        !groupDetails ||
        !Array.isArray(groupDetails.usersInGroup) ||
        !Array.isArray(groupDetails.usersNotInGroup)
      ) {
        console.error("Invalid group details received:", groupDetails);
        setUsersInSelectedGroup([]);
        setUsersNotInSelectedGroup([]);
        return;
      }

      // Set the state with validated data
      setUsersInSelectedGroup(groupDetails.usersInGroup);
      setUsersNotInSelectedGroup(groupDetails.usersNotInGroup);
    });

    socket.on("chat message", handleMessage);
    socket.on("chat history", (history) => {
      setMessages((prevMessages) => ({
        ...prevMessages,
        [history[0]?.chatId]: history,
      }));
    });

    socket.on(
      "login successful",
      ({ user, usersWithSameParent, chatHistory }) => {
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
      }
    );

    socket.on("login failed", (error) => {
      console.error("Login failed:", error);
    });

    socket.on("user joined", (user) =>
      setUsers((prevUsers) => [...prevUsers, user])
    );
    socket.on("user left", (userId) =>
      setUsers((prevUsers) => prevUsers.filter((user) => user.id !== userId))
    );
    socket.on("group created", (group) =>
      setGroups((prevGroups) => [...prevGroups, group])
    );
    socket.on("group list", handlegrouplist);

    socket.on("incoming-call", handleIncomingCall);
    socket.on("call-ended", handleCallEnded);
    socket.on("check-call", handlecheckcall);

    socket.on("i am on call", (callingsockets,currentuser,data2) => {
      console.log("i am oncall", callingsockets[0], callingsockets[1],currentuser,data2,groups);
      if(data2){
        for(let i=0;i<groups.length;i++){
          if(groups[i].id===data2.id){
            groups[i].oncall.push(currentuser.id);
            console.log("groupsname", groups[i].name);
          }
        }
      }
     
      for (let i = 0; i < callingsockets.length; i++) {
        setUsersOnCall((prevusersoncall) => [
          ...prevusersoncall,
          callingsockets[i],
        ]);
      }
    });

    socket.on("group-call-incoming", handlegroupincomingcall);
    socket.on("member-call-incoming", handlemembercallincoming);
    socket.on("call-list-update", handlecalllistupdate);
    peer.on("call", handleIncomingPeerCall);

    return () => {
      socket.off("chat message", handleMessage);
      socket.off("login successful");
      socket.off("login failed");
      socket.off("user list");
      socket.off("user joined");
      socket.off("user left");
      socket.off("group created");
      socket.off("group list", handlegrouplist);
      socket.off("sub-employee joined");
      socket.off("incoming-call", handleIncomingCall);
      socket.off("call-ended", handleCallEnded);
      socket.off("check-call", handlecheckcall);
      socket.off("removed from group");
      socket.off("i am on call");
      socket.off("group-call-incoming", handlegroupincomingcall);
      socket.off("member-call-incoming", handlemembercallincoming);
      socket.off("call-list-update", handlecalllistupdate);

      peer.off("call", handleIncomingPeerCall);
    };
  }, [
    socket,
    peer,
    selectedGroup,
    userId,
    usersNotInSelectedGroup,
    incominggroupcall,
    useroncall,groups,groupstreams
  ]);

  // useEffect(()=>{
  //   if(selectedUser && usersoncall){
  //     console.log("userconcall", usersoncall,selectedUser.socketId);
  //   console.log("typeof",typeof(usersoncall[0]),typeof(selectedUser.socketId),usersoncall[1]);
  //   }

  // },[usersoncall,selectedUser])

  const startCall = useCallback(async () => {
    //check()
    console.log("started-call");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setLocalStream(stream);
      localStreamRef.current=stream

      const call = peer.call(selectedUser.id, stream);
      //call.on("stream", handleStream);

      socket.emit("call-user", {
        useroncall: useroncall,
        signalData: myId,
      });

      setIsCallActive(true);
    } catch (error) {
      console.error("Error starting call:", error);
    }
  }, [selectedUser, socket, myId, peer, useroncall]);
  // useEffect(()=>{
  //   console.log("localstreamref", localStreamRef.current);
  // }, [localStreamRef,localStream])

  const handleIncomingCall = useCallback(
    (data) => {
      console.log("incomingcall", data,localStreamRef.current);
      //if (useroncall ) {
       
        console.log("ussssssssssssssssscall", localStream, useroncall);
        //socket.emit("user-in-call");
        //return;
      //}
      setIncomingCall(data);
      setUserOnCall(data.useroncall);
    },
    [useroncall, localStream, socket]
  );

  const handlegrouplist = (data) => {
    //console.log("group-listtttt", data);
    setGroups(data);
    if (selectedGroup) {
      for (let i = 0; i < data.length; i++) {
        if (data[i].id === selectedGroup.id) {
          selectedGroup.oncall = data[i].oncall;
        }
      }
    }
  };
  const getmediastream = useCallback(async () => {
    console.log("getmediastream", localStream);
    if (localStream) {
      return localStream;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setLocalStream(stream);
      return stream;
    } catch (error) {
      console.error("Error accepting call:", error);
    }
  }, []);

  const handleIncomingPeerCall = useCallback(async (call) => {
    console.log("handleincomingpeercall");
    if(localStreamRef.current){
      setLocalStream(localStreamRef.current);
      // setLocalStream(stream);
      call.answer(localStreamRef.current);
      call.on("stream", handleStream);
      setIsCallActive(true);
    }
    else{
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setLocalStream(stream);
        call.answer(stream);
        call.on("stream", handleStream);
        setIsCallActive(true);
      } catch (error) {
        console.error("Error accepting call:", error);
      }
    }
   
  }, [localStreamRef]);

  const acceptCall = useCallback(async () => {
    console.log("acceptcalll");
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
  }, [incominggroupcall, socket, myId, peer, incomingCall]);

  const handleStream = useCallback(
    (remoteStream) => {
      // if(incominggroupcall){
      //   return ;
      // }
      // console.log("handlestream", remoteStream);
      setGroupStreams((prevgroupstreams) => [
        ...prevgroupstreams,
        remoteStream,
      ]);
      setRemoteStream(remoteStream);
    },
    [incominggroupcall]
  );

  useEffect(() => {
    console.log("groupstreams", groupstreams, localStream,localStreamRef.current);
  }, [groupstreams, localStream,localStreamRef]);

  const endCall = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
     
    }
    if(localStreamRef.current){
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    setLocalStream(null);
    setRemoteStream(null);
    setGroupStreams([]);
    setIsCallActive(false);
    localStreamRef.current=null;
   

    socket.emit("end-call", useroncall.id);
    //console.log("select",selectedUser);
    //setUserOnCall(null);
  }, [localStream, socket, useroncall, remoteStream, localStreamRef]);

  const handleCallEnded = useCallback(
    (data1, data2,videoid) => {
      //console.log("selecteduser call ended", data1, data2,vi);
      if (data2 && socket.id === data1) {
        if (localStream) {
          localStream.getTracks().forEach((track) => track.stop());
        }
        if (remoteStream) {
          remoteStream.getTracks().forEach((track) => track.stop());
        }
        localStreamRef.current=null;
        setLocalStream(null);
        setRemoteStream(null);
        setIsCallActive(false);
        setGroupStreams([]);
      } else if (!data2) {
        if (localStream) {
          localStream.getTracks().forEach((track) => track.stop());
          localStreamRef.getTracks().forEach((track) => track.stop());
        }
        if (remoteStream) {
          remoteStream.getTracks().forEach((track) => track.stop());
        }
        setLocalStream(null);
        setRemoteStream(null);
        setIsCallActive(false);
        setGroupStreams([]);
      }
      if (data2) {
        //setGroupStreams([]);
        setIncomingGroupCall(null);
      } else {
        setIncomingCall(null);
      }
      //setUserOnCall(null);
    },
    [localStream, remoteStream, userid, socket,isCallActive, localStreamRef,groupstreams]
  );

  const startGroupCall = useCallback(async () => {
    //console.log("seleceted-groupppppppp", selectedGroup);
    //check()
    //console.log("started-call");
    try {
      let stream;
      console.log("startvcallreffff", localStreamRef.current)
      if (localStreamRef.current) {
        stream = localStreamRef.current;
      } else {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setLocalStream(stream);
        localStreamRef.current=stream

      }
      console.log("group-details", selectedGroup.members);
      for (let i = 0; i < selectedGroup.members.length; i++) {
        console.log("startgroupcall handlestream", selectedGroup.members[i]);
        if (selectedGroup.members[i] != userid) {
          const call = peer.call(selectedGroup.members[i], stream);

          call.on("stream", handleStream);
        }
      }

      //console.log("group-call");
      socket.emit("group-call", selectedGroup, myId);
      // socket.emit("call-user", {
      //   useroncall: useroncall,
      //   signalData: myId,
      // });

      setOnCallGroup(selectedGroup);
      setIsCallActive(true);
      setOnGroupCall(true);
    } catch (error) {
      console.error("Error starting call:", error);
    }
  }, [selectedGroup, socket, myId, peer, useroncall, localStream,localStreamRef]);
    const checkcallactive= ()=>{
      console.log("checkcaaaaaaaaaaalaaccitbe0", isCallActive);
      return isCallActiveRef.current
      //return isCallActive;
    }
 
    const handlegroupincomingcall = useCallback(
      (data) => {
        console.log(
          "groupincomingcall",
          data.data.members,
          data.from,
          isCallActive,
          remoteStream
        );
        setGroupData(data);
        console.log("incoming data", data);
        const check = checkcallactive();
        if (check) {
          console.log("responseiscallactive",check)
          return;
        }
       
        // if (useroncall || localStream) {
        //   socket.emit("user-in-call");
        //   return;
        // }
        setIncomingGroupCall(data);
        setUserOnCall(data.useroncall);
        console.log("incoming calllllreeeed", localStreamRef.current)
        if (localStream) {
          //console.log("datalocalstream", localStream);
          data.data.members.forEach((member) => {
            const call = peer.call(member, localStreamRef.current);
            call.on("stream", (remoteStream) => {
              //console.log("handlegroupincomingcall handlestream");
              handleStream(remoteStream);
            });
          });
        }

        // data.members.forEach((member) => {
        //   const call = peer.call(member, localStream);
        //   call.on("stream", (remoteStream) => {
        //     handleStream(remoteStream);
        //   });
        // });
      },
      [useroncall, localStream, socket, incominggroupcall,checkcallactive,isCallActive,groupdata,localStreamRef]
    );

  const acceptgroupCall = useCallback(async () => {
    console.log("acceptgroupcalll");
    //setgrouponcall(groupdata);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setLocalStream(stream);
      localStreamRef.current=stream

      const call = peer.call(incominggroupcall.signal, localStreamRef.current);
      call.on("stream", handleStream);
      //console.log("prevgroupdata", groupdata);
      socket.emit("answer-call", {
        signal: myId,
        to: incominggroupcall.from,
        groupcall: true,
      });

      groupdata.data.members.forEach((member) => {
        console.log("groupdatassssssssss", member);
        if (groupdata.from != member && member != userid.userid) {
          //console.log("groupdatassssssssssffeferr", member,userid.userid);
          const call = peer.call(member, localStreamRef.current);
          // console.log("acceptgroupcall handlestream");
          call.on("stream", handleStream);
          //socket.emit("member-call", { signal: myId, to: groupdata.from });
          socket.emit("member-call", myId, groupdata, member);
        }
      });

     
      setIsCallActive(true);
      setOnCallGroup(groupdata.data);
      setIncomingGroupCall(null);
      setOnGroupCall(true);
    } catch (error) {
      console.error("Error accepting call:", error);
    }
  }, [incominggroupcall, socket, myId, peer, userid, localStream,localStreamRef]);

  //const handlemembercallincoming

  const handlemembercallincoming = useCallback(
    async (data) => {
      //if(localStream){

      //}

      console.log(
        "incominggroupcall at function start:",
        incominggroupcall,
        groupstreams,localStreamRef.current
      );
      if (incominggroupcall) {
        console.log("returnedddddddddddddddddd");
        return;
      }
      console.log("groupincomingcallmembersssss", data, localStream);

      try {
        //setLocalStream(stream);
        if (!incominggroupcall) {
          if (localStream||localStreamRef.current) {
            const call = peer.call(data.signal, localStreamRef.current);
            console.log("handlemembercallincoming handlestream", groupstreams);
            call.on("stream", handleStream);
          } else {
            const stream = await navigator.mediaDevices.getUserMedia({
              audio: true,
            });
            localStreamRef.current=stream
            const call = peer.call(data.signal, stream);
            console.log("handlemembercallincoming handlestream", groupstreams);
            call.on("stream", handleStream);
          }
        }
      } catch (error) {
        console.error("Error accepting call:", error);
      }
    },
    [useroncall, localStream, socket, peer, incominggroupcall,localStreamRef,groupstreams]
  );

  const joinGroupCall = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      //setLocalStream(stream);
      localStreamRef.current=stream
      //console.log("prevgroupdata", groupdata);

      selectedGroup.oncall.forEach((member) => {
        console.log("sssssssselle", selectedGroup)
        console.log("groupdata", member);
        // if (groupdata.from != member) {
        const call = peer.call(member, stream);
        call.on("stream", handleStream);
        //socket.emit("member-call", { signal: myId, to: groupdata.from });
        //socket.emit("member-call", myId, selectedGroup, member);
        socket.emit("join-group-call", myId, selectedGroup, member);
        // }
      });

      // socket.emit("answer-call", {
      //   signal: myId,
      //   to: incominggroupcall.from,
      //   groupcall: true,
      // });
      //setGroupData(selectedGroup);
      setOnCallGroup(selectedGroup);
      setIsCallActive(true);
      setIncomingGroupCall(null);
      setOnGroupCall(true);
    } catch (error) {
      console.error("Error accepting call:", error);
    }
  }, [peer, socket, , selectedGroup, localStream,localStreamRef.current]);

  const groupcalldeclined = useCallback(() => {
    socket.emit ("group-call-declined");
    setIncomingGroupCall(null);
  }, [socket]);

  const endgroupCall = useCallback(() => {
    let targetuserid = userid;
    socket.emit("end-call", targetuserid, oncallgroup, localStreamRef.current.id);
    setOnGroupCall(false);
    console.log("ended-groupcall");
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    setLocalStream(null);
    setRemoteStream(null);
    setIsCallActive(false);
    setGroupStreams([]);
    localStreamRef.current=null;
   
   
    //socket.emit("end-call", useroncall.id);
    //console.log("select",selectedUser);
    //setUserOnCall(null);
  }, [localStream, socket, useroncall,remoteStream, localStreamRef]);

  // useEffect(()=>{
  //   console.log("iscallactive", isCallActive);

  // },[isCallActive])

  // const check=()=>{
  //   socket.emit("check-available",{
  //     useroncall: useroncall,
  //     signalData: peerId,
  //   })
  // }
  // const handlereponsefinal=(data)=>{
  //   //console.log("dataaaaaaaa",data);
  //   startCall();
  // }
  const calldeclined = () => {
    setIncomingCall(null);
    //console.log("useroncall", useroncall);
    endCall();
  };

  const handlecheckcall = useCallback(
    (data) => {
      console.log("remotestream-localstream", isCallActive, data);
      //socket.emit ("response", data);
    },
    [isCallActive]
  );

  const handlecalllistupdate = (data1, data2,videoid) => {
    console.log("videoid", videoid, groupstreams);
    if(groupstreams.length){
      for(let i=0;i<groupstreams.length;i++){
        console.log("gggggggggggggggggggggg", groupstreams[i], groupstreams[i].id)
        if(groupstreams[i].id==videoid){
          groupstreams.splice(i,1)
        }
      }
    }
   
    setUsersOnCall((prevusersoncall) =>
      prevusersoncall.filter((usersoncall) => usersoncall !== data1)
    );
    for (let i = 0; i < data2.length; i++) {
      setUsersOnCall((prevusersoncall) =>
        prevusersoncall.filter((usersoncall) => usersoncall !== data2[i])
      );
    }
  };

  const addUserToGroup = useCallback(
    (userIdToAdd) => {
      if (socket && selectedGroup) {
        socket.emit("add to group", {
          groupId: selectedGroup.id,
          userId: userIdToAdd,
        });
      }
    },
    [socket, selectedGroup]
  );

  // Update the removeUserFromGroup function
  const removeUserFromGroup = useCallback(
    (userIdToRemove) => {
        if (socket && selectedGroup) {
            // Emit the socket event to remove the user from the group
            socket.emit("remove from group", {
                groupId: selectedGroup.id,
                userId: userIdToRemove,
            });
 
            // Immediately update the local state for real-time update
            setUsersInSelectedGroup((prevUsers) =>
                prevUsers.filter((user) => user.id !== userIdToRemove)
            );
 
            setUsersNotInSelectedGroup((prevUsers) => [
                ...prevUsers,
                // Assuming you have access to the user details here, add them back to the "add user" list
                users.find((user) => user.id === userIdToRemove),
            ]);
 
            if (userIdToRemove === userId) {
                // If the user is removing themselves, update the UI immediately
                setGroups((prevGroups) =>
                    prevGroups.filter((group) => group.id !== selectedGroup.id)
                );
                setSelectedGroup(null);
                setActiveChat("private");
            }
        }
    },
    [socket, selectedGroup, userId, users]
);

  const getChatId = (user1, user2) => {
    return [user1, user2].sort().join("-");
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (contentEditableRef.current) {
      const contentHtml = contentEditableRef.current.innerHTML.trim();

      if (contentHtml !== "" || images.length > 0) {
        const messageData = {
          id: Date.now().toString(),
          text: contentHtml, // Store the HTML content directly
          sender: userId,
          chatId:
            activeChat === "private"
              ? getChatId(userId, selectedUser?.id)
              : activeChat === "group"
              ? `group-${selectedGroup?.id}`
              : employerRoom,
          receiver: activeChat === "private" ? selectedUser?.id : undefined,
        };

        if (images.length > 0) {
          const readers = images.map((img) => {
            return new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result);
              reader.readAsDataURL(img);
            });
          });

          Promise.all(readers).then((imageResults) => {
            socket.emit("chat message", {
              ...messageData,
              images: imageResults,
            });
            setImages([]);
            setImagePreviews([]);
            contentEditableRef.current.innerHTML = "";
          });
        } else {
          socket.emit("chat message", messageData);
          contentEditableRef.current.innerHTML = "";
        }
      }
    }
  };

  const selectUser = (user) => {
    setSelectedUser(user);
    console.log("user", user);
    // if(!useroncall){
    setUserOnCall(user);
    //}
    setActiveChat("private");
    setSelectedGroup(null);
    const chatId = getChatId(userId, user.id);
    socket.emit("fetch chat history", chatId);
  };

  const selectGroup = (group) => {
    //console.log("selectedgroup", group);
    setSelectedGroup(group);
    setActiveChat("group");
    setSelectedUser(null);
    const chatId = `group-${group.id}`;
    socket.emit("fetch chat history", chatId);
    socket.emit("fetch group details", group.id);
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
            <p className="text-red-500">
              No users available to add to the group.
            </p>
          ) : (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700">
                Select User to Add:
              </label>
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
                console.warn("No user selected to add.");
              }
              setShowAddUserModal(false);
              setUserIdToAdd("");
            }}
            className="mt-2 px-4 py-2 bg-green-500 text-white rounded"
            disabled={!userIdToAdd}
          >
            Add User
          </button>
          <button
            onClick={() => {
              setShowAddUserModal(false);
              setUserIdToAdd("");
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
            <p className="text-red-500">
              No users available to remove from the group.
            </p>
          ) : (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700">
                Select User to Remove:
              </label>
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
                console.warn("No user selected to remove.");
              }
              setShowRemoveUserModal(false);
              setUserIdToRemove("");
            }}
            className="mt-2 px-4 py-2 bg-red-500 text-white rounded"
            disabled={!userIdToRemove}
          >
            Remove User
          </button>
          <button
            onClick={() => {
              setShowRemoveUserModal(false);
              setUserIdToRemove("");
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
    <div className=" h-screen w-screen">
      <div className="flex h-screen max-w-4xl mx-auto p-4">
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

        {incominggroupcall && !incomingCall && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white p-4 rounded">
              <h2 className="text-lg font-semibold mb-2">
                Incoming Call group
              </h2>
              <p>
                {users.find((u) => u.id === incominggroupcall.from)?.username}{" "}
                is calling you.
              </p>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={groupcalldeclined}
                  className="bg-red-500 text-white px-4 py-2 rounded mr-2"
                >
                  Decline
                </button>
                <button
                  onClick={acceptgroupCall}
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
                activeChat === "group"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200"
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
              <input
                type="text"
                placeholder="Search Users"
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                className="mb-2 p-2 border rounded"
              />
              <div className="h-64 border rounded p-2 overflow-y-auto">
                {filteredUsers
                  .filter((user) => user.id !== userId) // Exclude logged-in user
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
              <input
                type="text"
                placeholder="Search Groups"
                value={groupSearchQuery}
                onChange={(e) => setGroupSearchQuery(e.target.value)}
                className="mb-2 p-2 border rounded"
              />
              <div className="h-48 border rounded p-2 mb-2 overflow-y-auto">
                {filteredGroups.map((group) => (
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
              {!isCallActive ? (
                selectedUser ? (
                  usersoncall.includes(String(selectedUser.socketId)) ? (
                    <p className="text-red-500">
                      User is not available for call
                    </p>
                  ) : (
                    <button
                      onClick={startCall}
                      className="bg-green-500 text-white px-4 py-2 rounded mr-2"
                    >
                      start Call
                    </button>
                  )
                ) : selectedGroup ? (

                  selectedGroup.oncall.length ? (
                    <button onClick={joinGroupCall}>
                      join call {selectedGroup.name}
                    </button>
                  ) : (
                    <button
                      onClick={startGroupCall}
                      className="bg-green-500 text-white px-4 py-2 rounded mr-2"
                    >
                      start group Call
                    </button>
                  )
                ) : (
                  <h>no user selected</h>
                )
              ) : (
                <>
                  {useroncall && !ongroupcall && (
                    <button
                      onClick={endCall}
                      className="bg-red-500 text-white px-4 py-2 rounded"
                    >
                      End Call
                    </button>
                  )}
                  {ongroupcall && (
                    <button
                      onClick={endgroupCall}
                      className="bg-red-500 text-white px-4 py-2 rounded"
                    >
                      End Group Call
                    </button>
                  )}
                </>
              )}
            </div>

            {isCallActive && !groupstreams && (
              <div className="mt-4  flex flex-col">
                <p className="h-[10px]">Call in progress with </p>
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
            {isCallActive && groupstreams && (
              <div className="mt-4  flex flex-col">
                <p className="h-[10px]">Call in progress with </p>
                {groupstreams.map((item, index) => (
                  <div key={index}>
                    <h1>hiii</h1>
                    <audio
                      ref={(audio) => {
                        if (audio && item) {
                          audio.srcObject = item;
                          audio.play();
                        }
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className=" flex flex-grow flex-col mb-4 border rounded p-2 overflow-auto custom-scrollbar">
            {currentMessages.map((message, index) => (
              <React.Fragment key={index}>
                {shouldShowDateHeader(message, currentMessages[index - 1]) && (
                  <div className="text-center my-2">
                    <span className="bg-gray-200 text-time px-2 py-1 rounded-full text-[10px]">
                      {formatDate(message.createdAt)}
                    </span>
                  </div>
                )}
                <div
                  key={index}
                  id={`message-${index}`} // Assign unique id for scrolling
                  className={`mb-2 ${message.sender === userId ? "text-right" : "text-left"}
        ${currentSearchIndex === searchResults.indexOf(index) ? "highlighted-message" : ""}`} // Add highlighted class
                >
                  <span className="font-bold ">
                    {message.sender === userId ? "You" : users.find((u) => u.id === message.sender)?.username}:
                  </span>{" "} <span>{formatTime(message.createdAt)}</span>
                  <span className="bg-white text-black pl-2 pr-3 py-1 preserve-whitespace h-auto">
                    {renderMessage(message.text, message.images)}
                  </span>
                </div>
              </React.Fragment>
            ))}
          </div>

          <div className="flex w-[100px]">
            <form
              onSubmit={handleSubmit}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              <div className="flex p-3 items-end space-x-1 w-[500px]">
                <input
                  type="file"
                  multiple
                  id="fileInput"
                  onChange={handleImageChange}
                  className="hidden"
                />
                <div
                  ref={contentEditableRef}
                  contentEditable
                  onInput={handleContentChange}
                  onDrop={handleDrop}
                  onPaste={handlePaste}
                  onKeyDown={handleKeyDown}
                  onDragOver={handleDragOver}
                  className="flex-grow bg-white border preserve-whitespace rounded-lg px-4 py-2"
                  placeholder="Type your message..."
                  style={{
                    //whiteSpace: 'pre-wrap',
                    whiteSpace: "break-spaces",
                    overflowWrap: "break-word",
                    overflowY: "auto",
                    maxHeight: "150px", // Adjust the max height to fit your needs
                  }}
                />
                <label
                  htmlFor="fileInput"
                  className="cursor-pointer flex-shrink-0"
                >
                  <img
                    src="https://www.svgrepo.com/show/490988/attachment.svg"
                    alt="Attachment"
                    width={50}
                    height={50}
                  />
                </label>
                <button
                  type="submit"
                  className="bg-blue-500 text-white px-4 py-2 rounded-lg flex-shrink-0"
                >
                  Send
                </button>
              </div>
            </form>
            <div className="search-bar">
              <form onSubmit={handleSearch}>
                <input
                  type="text"
                  placeholder="Search messages"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button type="submit">Search</button>

                {/* Close button to clear search */}
                {searchResults.length > 0 && (
                  <button type="button" onClick={clearSearch} title="Clear Search">✖</button>
                )}
              </form>

              {searchResults.length > 0 && (
                <div>
                  <button onClick={goToPreviousResult}>Previous</button>
                  <span> {currentSearchIndex + 1}/{searchResults.length} </span>
                  <button onClick={goToNextResult}>Next</button>
                </div>
              )}
            </div>

            {/* <div className="messages">
              {filteredMessages.map((message, index) => {
                const isMatched = searchResults.includes(index);
                const isHighlighted = currentSearchIndex === searchResults.indexOf(index);

                return isMatched ? (
                  <div
                    key={index}
                    id={`message-${index}`} // Unique ID for scrolling
                    className={`mb-2 ${isHighlighted ? 'highlighted-message' : ''}`}
                    onClick={() => scrollToMessage(index)} // Scroll to the original message
                  >
                    <span className="font-bold ">
                      {message.sender === userId ? "You" : users.find((u) => u.id === message.sender)?.username}:
                    </span>{" "}
                    <span className="bg-white text-black pl-2 pr-3 py-1 preserve-whitespace h-auto">
                      {renderMessage(message.text)}
                    </span>
                  </div>
                ) : null; // Do not render if not matched
              })}
            </div> */}

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

      {viewingImage && (
        <div
          className="image-viewer-overlay"
          onClick={(e) => e.currentTarget === e.target && setViewingImage(null)}
          onMouseUp={handleMouseUp}
        >
          <div
            className="image-viewer-container"
            onMouseUp={handleMouseUp}
            onClick={(e) =>
              e.currentTarget === e.target && setViewingImage(null)
            }
          >
            <img
              ref={imageRef}
              src={viewingImage}
              alt="Viewing"
              className="image-viewer-img"
              style={{
                position: "absolute",
                top: `${imagePosition.y}px`,
                left: `${imagePosition.x}px`,
                transform: `scale(${zoom})`,
                cursor: isHolding ? "grabbing" : "grab",
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onLoad={handleImageLoad}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatWindow;
