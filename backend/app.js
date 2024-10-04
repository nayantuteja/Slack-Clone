
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";
import { ExpressPeerServer } from "peer";
import dotenv from "dotenv";
import { Socket } from "dgram";
dotenv.config();
const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const peerServer = ExpressPeerServer(server, {
  debug: true,
  path: "/myapp",
});

app.use("/peerjs", peerServer);

// MongoDB connection setup
const mongoURI = process.env.MONGO_URI;
mongoose
  .connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Define MongoDB Schemas and Models
const userSchema = new mongoose.Schema({
  id: String,
  username: String,
  userType: String,
  parentId: String,
  socketId: String,
});

const groupSchema = new mongoose.Schema({
  id: String,
  name: String,
  members: [String],
  parentId: String,
  createdBy: String,
  oncall: {
    type: [String], // Array of user IDs currently on call
    default: [], // Initialize as an empty array
  },
});

const messageSchema = new mongoose.Schema({
  text: String,
  sender: String,
  receiver: { type: String, default: null },
  chatId: String,
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.model("User", userSchema);
const Group = mongoose.model("Group", groupSchema);
const Message = mongoose.model("Message", messageSchema);

const users = new Map();
const groups = new Map();
let callingsockets = [];
let groupsoncall = [];

const removeOnCallUser = async (groupId, userId, socketid) => {
  try {
    const updatedGroup = await Group.findOneAndUpdate(
      { id: groupId }, // Find the group by the custom `id`
      { $pull: { oncall: userId } }, // Remove the userId from the oncall array
      { new: true } // Return the updated document
    );

    // if (updatedGroup) {
    //   console.log(
    //     `Removed user ${userId} from oncall for group ${groupId}:`,
    //     updatedGroup
    //   );
    // } else {
    //   console.error(
    //     "Failed to update group or group not found with id:",
    //     groupId
    //   );
    // }
  } catch (error) {
    console.error("Error removing oncall user:", error);
  }

  const group = await Group.findOne({ id: groupId });
  const userdata = users.get(socketid);
  const usersWithSameParent = [];
  
  users.forEach((value, key) => {
    //console.log("valueparent", value.parentId,useroncall);

    if (userdata.parentId === value.parentId) {
      //console.log("datasocket", value.socketId);
      
      usersWithSameParent.push(value.socketId);
    }
  });

  usersWithSameParent.forEach(async(socket) => {
    //const user = users.get(socket.id);
    //if (user && user.parentId === parentId) {
    const u= users.get(socket);
    const groupList = await Group.find({ members: { $in: u.id } });
    //console.log("userswithsameparent", groupList,u);
    io.to(socket).emit("group list", groupList);
    //}
  });
};

// Dummy database
const dummyEmployees = {
  "employees": [
    { "name": "Alice Johnson", "catcher_id": "CATCHER001", "parent_id": "CATCHER001", "type_id": 1 },
    { "name": "Bob Smith", "catcher_id": "CATCHER002", "parent_id": "CATCHER001", "type_id": 0 },
    { "name": "Charlie Brown", "catcher_id": "CATCHER003", "parent_id": "CATCHER001", "type_id": 0 },
    { "name": "David Wilson", "catcher_id": "CATCHER004", "parent_id": "CATCHER001", "type_id": 0 },
    { "name": "Eva Adams", "catcher_id": "CATCHER005", "parent_id": "CATCHER001", "type_id": 0 },
    { "name": "Frank Miller", "catcher_id": "CATCHER006", "parent_id": "CATCHER001", "type_id": 0 },
    { "name": "Grace Lee", "catcher_id": "CATCHER007", "parent_id": "CATCHER007", "type_id": 1 },
    { "name": "Henry Taylor", "catcher_id": "CATCHER008", "parent_id": "CATCHER007", "type_id": 0 },
    { "name": "Isabella Martinez", "catcher_id": "CATCHER009", "parent_id": "CATCHER007", "type_id": 0 },
    { "name": "Jack White", "catcher_id": "CATCHER010", "parent_id": "CATCHER010", "type_id": 1 },
    { "name": "Karen Harris", "catcher_id": "CATCHER011", "parent_id": "CATCHER010", "type_id": 0 },
    { "name": "Leo Scott", "catcher_id": "CATCHER012", "parent_id": "CATCHER010", "type_id": 0 },
    { "name": "Mia King", "catcher_id": "CATCHER013", "parent_id": "CATCHER010", "type_id": 0 },
    { "name": "Noah Wright", "catcher_id": "CATCHER014", "parent_id": "CATCHER010", "type_id": 0 },
    { "name": "Paul Young", "catcher_id": "CATCHER015", "parent_id": "CATCHER015", "type_id": 1 },
    { "name": "Quinn Lopez", "catcher_id": "CATCHER016", "parent_id": "CATCHER015", "type_id": 0 },
    { "name": "Rachel Robinson", "catcher_id": "CATCHER017", "parent_id": "CATCHER015", "type_id": 0 }
  ]
};

const updateUserList = async (parentId) => {
  const userList = dummyEmployees.employees
    .filter((emp) => emp.parent_id === parentId)
    .map((emp) => ({
      id: emp.catcher_id,
      username: emp.name,
      userType: emp.type_id === 1 ? "employer" : "sub-employee",
      parentId: emp.parent_id,
      socketId: Array.from(users.entries()).find(
        ([_, user]) => user.id === emp.catcher_id
      )?.[0],
    }));

  const sockets = await io.fetchSockets();
  sockets.forEach((socket) => {
    const user = users.get(socket.id);
    if (user && user.parentId === parentId) {
      socket.emit("user list", userList);
    }
  });
};

const updateGroupList = async (members) => {
  const groupList = await Group.find({ members: { $in: members } });
  members.forEach((memberId) => {
    const memberSocket = Array.from(users.values()).find(
      (user) => user.id === memberId
    )?.socketId;
    if (memberSocket) {
      io.to(memberSocket).emit("group list", groupList);
    }
  });
};

io.on("connection", (socket) => {
  console.log("A user connected");

  socket.on("login", async (catcherId) => {
    const employee = dummyEmployees.employees.find(
      (emp) => emp.catcher_id === catcherId
    );
    if (employee) {
      const chatHistory = await Message.find({
        $or: [
          { sender: employee.catcher_id },
          { receiver: employee.catcher_id },
          { chatId: `employer-${employee.parent_id}` },
        ],
      }).sort({ createdAt: 1 });
      const user = {
        id: employee.catcher_id,
        username: employee.name,
        socketId: socket.id,
        userType: employee.type_id === 1 ? "employer" : "sub-employee",
        parentId: employee.parent_id,
      };

      // Save the user to the database
      let existingUser = await User.findOne({ id: user.id });

      if (existingUser) {
        // User exists, update their data
        const xsocketid = existingUser.socketId;
        existingUser.username = user.username;
        existingUser.socketId = user.socketId; // Update with new socketId
        existingUser.userType = user.userType;
        existingUser.parentId = user.parentId;

        // Save the updated user to the database
        //console.log("prevsocketid", xsocketid);
        users.delete(xsocketid);
        users.set(socket.id, user);
        //await existingUser.save();
      } else {
        const newUser = new User(user);
        //await newUser.save();
        users.set(socket.id, user);
      }

      // Fetch all users with the same parentId
      socket.userId = user.id;
      const userGroups = await Group.find({ members: user.id });
      const usersWithSameParent = dummyEmployees.employees
        .filter((emp) => emp.parent_id === user.parentId)
        .map((emp) => ({
          id: emp.catcher_id,
          username: emp.name,
          userType: emp.type_id === 1 ? "employer" : "sub-employee",
          parentId: emp.parent_id,
          socketIds: users[emp.catcher_id]?.socketIds || [],
        }));
      //console.log("useerwithsameparent", usersWithSameParent,users);
      socket.emit("login successful", {
        user,
        usersWithSameParent,
        chatHistory,
        groups: userGroups,
      });

      const roomId = `employer-${user.parentId}`;
      socket.join(roomId);
      //console.log(`${user.userType} ${user.username} joined room ${roomId}`);
      //const groupList = await Group.find({ members: { $in: employee.catcher_id } });
      //io.to(user.socketId).emit("group list", groupList);

      //const userGroups = await Group.find({ members: user.id });

      // Update the groups map with fetched groups from MongoDB
      userGroups.forEach((group) => {
        groups.set(group.id, group);
      });
      //console.log("usergroups", userGroups, groups);

      // Emit the group list to the user
      io.to(user.socketId).emit("group list", userGroups);
      io.to(user.socketId).emit("i am on call", callingsockets);

      if (user.userType === "sub-employee") {
        const employerSocket = Array.from(users.values()).find(
          (u) => u.id === user.parentId
        )?.socketId;
        if (employerSocket) {
          io.to(employerSocket).emit("sub-employee joined", user);
        }
      }
      await updateUserList(user.parentId);
    } else {
      socket.emit("login failed", "User not found");
    }
  });

  socket.on("create group", async (groupData) => {
    const user = users.get(socket.id);
    //console.log("groupdata", groupData);
    if (!user) return;

    const groupId = uuidv4();
    const newGroup = {
      id: groupId,
      name: groupData.name,
      members: groupData.members,
      parentId: user.parentId,
      createdBy: user.id,
      oncall: [],
    };
    //console.log("group created", newGroup);

    // Save the group to the database
    const savedGroup = new Group(newGroup);
    await savedGroup.save();

    groups.set(groupId, newGroup);

    newGroup.members.forEach((memberId) => {
      //console.log("memberid", memberId);
      const member = Array.from(users.values()).find((u) => u.id === memberId);
      if (member) {
        io.to(member.socketId).emit("group created", newGroup);
      }
    });

    await updateGroupList(newGroup.members);
  });
  const getGroupDetails = async (groupId, allUsers) => {
    const group = await Group.findOne({ id: groupId });

    const usersInGroup = allUsers.filter((user) =>
      group.members.includes(user.id)
    );

    const usersNotInGroup = allUsers.filter(
      (user) => !group.members.includes(user.id)
    );

    return { ...group.toObject(), usersInGroup, usersNotInGroup };
  };
  socket.on("add to group", async ({ groupId, userId }) => {
    try {
      const group = await Group.findOne({ id: groupId });
      const allUsers = dummyEmployees.employees
        .filter((emp) => emp.parent_id === group.parentId)
        .map((emp) => ({
          id: emp.catcher_id,
          username: emp.name,
          userType: emp.type_id === 1 ? "employer" : "sub-employee",
        }));

      if (group && group.createdBy === socket.userId) {
        if (!group.members.includes(userId)) {
          group.members.push(userId);
          await group.save();

          const updatedGroupDetails = await getGroupDetails(groupId, allUsers);

          // Emit the updated group to all members
          group.members.forEach((memberId) => {
            const memberSockets = users[memberId]?.socketIds || [];
            const addSocketIds = []; // Initialize an array to store keys

            users.forEach((values, keys) => {
              //console.log("valuesid", values, keys);
              if (values.id === memberId) {
                addSocketIds.push(keys); // Push the key into the array if the condition is met
              }
            });
            addSocketIds.forEach((socketId) => {
              io.to(socketId).emit("group updated", updatedGroupDetails);
            });
          });

          //console.log(`User ${userId} added to group ${groupId}`);
        }
      } else {
        socket.emit(
          "error",
          "You do not have permission to add users to this group."
        );
      }
    } catch (error) {
      console.error("Error adding user to group:", error);
      socket.emit(
        "error",
        "An error occurred while adding the user to the group."
      );
    }
  });

  // Event for removing a member from a group
  socket.on("remove from group", async ({ groupId, userId }) => {
    //console.log("user removed", groupId, userId);
    try {
      //console.log("ussssserrr rerreemmoovveedd");
      const group = await Group.findOne({ id: groupId });
      const allUsers = dummyEmployees.employees
        .filter((emp) => emp.parent_id === group.parentId)
        .map((emp) => ({
          id: emp.catcher_id,
          username: emp.name,
          userType: emp.type_id === 1 ? "employer" : "sub-employee",
        }));
      //console.log("removed group&& users", group.createdBy, socket.userId);

      if (group && group.createdBy === socket.userId) {
        group.members = group.members.filter((member) => member !== userId);
        await group.save();

        const updatedGroupDetails = await getGroupDetails(groupId, allUsers);

        // Emit to all remaining members
        group.members.forEach((memberId) => {
          const memberSockets = users[memberId]?.socketIds || [];
          memberSockets.forEach((socketId) => {
            io.to(socketId).emit("group updated", updatedGroupDetails);
          });
        });

        // Emit a specific event to the removed user

        const removedUserSockets = users[userId]?.socketIds || [];
        const removeuser = await User.findOne({ id: userId });
        const removedSocketIds = []; // Initialize an array to store keys

        users.forEach((values, keys) => {
          //console.log("valuesid", values, keys);
          if (values.id === userId) {
            removedSocketIds.push(keys); // Push the key into the array if the condition is met
          }
        });
        //console.log("removed users", removedSocketIds);
        //io.to(removedsocketid).emit("removed from group", groupId);
        removedSocketIds.forEach((socketId) => {
          //console.log("USER REMOVER", socketId, groupId);
          io.to(socketId).emit("removed from group", groupId);
        });

        //console.log(`User ${userId} removed from group ${groupId}`);
      } else {
        socket.emit(
          "error",
          "You do not have permission to remove users from this group."
        );
      }
    } catch (error) {
      console.error("Error removing user from group:", error);
      socket.emit(
        "error",
        "An error occurred while removing the user from the group."
      );
    }
  });

  socket.on("fetch group details", async (groupId) => {
    try {
      const group = await Group.findOne({ id: groupId });

      if (group) {
        // Fetch users from dummy data based on parentId

        const allUsers = dummyEmployees.employees

          .filter((emp) => emp.parent_id === group.parentId)

          .map((emp) => ({
            id: emp.catcher_id,

            username: emp.name,

            userType: emp.type_id === 1 ? "employer" : "sub-employee",
          }));

        // Find users in the group and those not in the group

        const usersInGroup = allUsers.filter((user) =>
          group.members.includes(user.id)
        );

        const usersNotInGroup = allUsers.filter(
          (user) => !group.members.includes(user.id)
        );

        // Emit the group details to the client

        socket.emit("group details", {
          id: group.id,

          usersInGroup,

          usersNotInGroup,
        });

        // console.log("Fetched group details:", {
        //   id: group.id,

        //   usersInGroup,

        //   usersNotInGroup,
        // });
      } else {
        socket.emit("error", "Group not found.");
      }
    } catch (error) {
      console.error("Error fetching group details:", error);

      socket.emit("error", "An error occurred while fetching group details.");
    }
  });

  socket.on("chat message", async (messageData) => {
    const sender = users.get(socket.id);
    if (!sender) return;
 
    const { receiver, chatId, text } = messageData;
    const newMessage = new Message({
        text,
        sender: sender.id,
        receiver: receiver || null,
        chatId,
    });
   
    await newMessage.save();
   
    // Add the `createdAt` field (timestamp) to the messageData before sending it to clients
    const messageToSend = {
        ...messageData,
        createdAt: newMessage.createdAt // Include the timestamp from the saved message
    };
 
    if (chatId.startsWith("group-")) {
        const groupId = chatId.split("group-")[1];
        const group = groups.get(groupId);
 
        if (group && group.members.includes(sender.id) && group.parentId === sender.parentId) {
            group.members.forEach((memberId) => {
                const member = Array.from(users.values()).find(u => u.id === memberId);
                if (member && member.socketId) {
                    io.to(member.socketId).emit("chat message", messageToSend); // Send message with timestamp
                }
            });
        }
    } else if (chatId === `employer-${sender.parentId}`) {
        io.to(chatId).emit("chat message", messageToSend); // Send message with timestamp
    } else if (receiver) {
        const receiverSocket = Array.from(users.values()).find(user => user.id === receiver && user.parentId === sender.parentId)?.socketId;
        const receiverSockets = Array.from(users.values()).filter(user => user.id === receiver).map(user => user.socketId);
        const senderSockets = Array.from(users.values()).filter(user => user.id === sender.id).map(user => user.socketId);
 
        receiverSockets.forEach(socketId => {
            io.to(socketId).emit("chat message", messageToSend); // Send message with timestamp
        });
        senderSockets.forEach(socketId => {
            io.to(socketId).emit("chat message", messageToSend); // Send message to sender with timestamp
        });
    }
});

  socket.on("fetch chat history", async (chatId) => {
    const chatHistory = await Message.find({ chatId }).sort({ createdAt: 1 });
    socket.emit("chat history", chatHistory);
  });

  socket.on("check-available", (data) => {
    //console.log("data", data);
    const { useroncall, signalData } = data;
    const userdetails = users.get(socket.id);
    //console.log("userdetails", userdetails, useroncall);
    const userToCall = Array.from(users.values()).find(
      (user) => user.id === useroncall.id
    );
    if (userToCall) {
      io.to(userToCall.socketId).emit("check-call", {
        signal: signalData,
        from: socket.id,
        useroncall: userdetails,
      });
    }
  });

  socket.on("response", (data) => {
    io.to(data.from).emit("response-final", data);
    //console.log("ddddd", data);
  });
  socket.on("call-user", (data) => {
    //console.log("usrs", users);
    //console.log("data", data);
    const { useroncall, signalData } = data;

    if (useroncall && useroncall.id) {
      const userdetails = users.get(socket.id);
      //console.log("userdetails", userdetails, useroncall);
      const userToCall = Array.from(users.values())
        .reverse()
        .find((user) => user.id === useroncall.id);

      if (userToCall) {
        io.to(userToCall.socketId).emit("incoming-call", {
          signal: signalData,
          from: socket.id,
          useroncall: userdetails,
        });
      }
    }
  });

  socket.on("answer-call", (data) => {
    //console.log("dddddddddddda", data.to, socket.id, data.groupcall);
    let current = users.get(socket.id);

    let usersWithSameParent = [];
    //console.log("usersonccall", users);
    users.forEach((value, key) => {
      //console.log("valueparent", value.parentId,useroncall);
      if (data.groupcall) {
        //console.log("vvvvvvvvvvvvvv", value);
        if (value.id === data.to || key === socket.id) {
          //console.log("111", key);
          callingsockets.push(key);
        }
      } else {
        if (key === data.to || key === socket.id) {
          callingsockets.push(key);
          //console.log("22222", key);
        }
      }

      if (current.parentId === value.parentId) {
        //console.log("datasocket", value.socketId);
        usersWithSameParent.push(value.socketId);
      }
    });
    //console.log("ddddooooooooo", usersWithSameParent, callingsockets);
    for (let i = 0; i < usersWithSameParent.length; i++) {
      //console.log("userswithsame", usersWithSameParent[i]);
      io.to(usersWithSameParent[i]).emit("i am on call", callingsockets);
    }
    if (!data.groupcall) {
      io.to(data.to).emit("call-accepted", data.signal);
    }
  });

  socket.on("end-call", (targetUserId, data2) => {
    let current = users.get(socket.id);
    if (data2) {
      
      targetUserId = targetUserId.userid;
      removeOnCallUser(data2.id, current.id, socket.id);
    }
    console.log("targetuserid", targetUserId, data2);
    let usersWithSameParent = [];
    //let callingsockets =[];

    //console.log("usersonccall", users);
    users.forEach((value, key) => {
      //console.log("valueparent", value.parentId,useroncall);

      if (current.parentId === value.parentId) {
        //console.log("datasocket", value.socketId);
        usersWithSameParent.push(value.socketId);
      }
    });
    //console.log("ddddooooooooo", usersWithSameParent);

    const targetSockets = Array.from(users.values())
      .filter((user) => user.id === targetUserId) // Find all users that match the condition
      .map((user) => user.socketId); // Extract their socketIds
    //console.log("targetsockets", targetSockets, users);
    for (let i = 0; i < usersWithSameParent.length; i++) {
      //console.log("userswithsame", usersWithSameParent[i]);
      io.to(usersWithSameParent[i]).emit("call-ended", socket.id, data2);
      //console.log("userswithsameparent", usersWithSameParent);
      io.to(usersWithSameParent[i]).emit(
        "call-list-update",
        socket.id,
        targetSockets
      );
    }

    // Emit to each socketId that satisfies the condition
    console.log("ttttttttttaaaaaaaaaaaaarrrgegeee", targetSockets, callingsockets);

    // callingsockets.forEach((sid)=>{
    //   console.log("calling sockets", sid,current.socketId,callingsockets.length);
    //   if(sid===current.socketId){
    //     console.log("deleteing sockkettt", sid)
    //     //callingsockets.splice(i, 1);
    //   }
    //   targetSockets.forEach((socketId)=>{
    //     if(sid===socketId){
    //       console.log("deleteing sockkettt2", sid)
    //       //callingsockets.splice(i, 1);
    //     }

    //   })

    // })
    // for(let i=0;i<callingsockets.length;i++){
    //   console.log("222")
    //   if(sid===current.socketId){
    //     console.log("deleteing sockkettt", sid)
    //     callingsockets.splice(i, 1);
    //   }
    //   targetSockets.forEach((socketId)=>{
    //     if(sid===socketId){
    //       console.log("deleteing sockkettt2", sid)
    //       callingsockets.splice(i, 1);
    //     }

    //   })
    // }

    for(let i=callingsockets.length-1;i>=0;i--){
      console.log("calling sockets", callingsockets[i],current.socketId,callingsockets.length);
      if(callingsockets[i]===current.socketId){
        console.log("deleteing sockkettt", callingsockets[i])
        callingsockets.splice(i, 1);
      }
      targetSockets.forEach((socketId)=>{
        if(callingsockets[i]===socketId){
          console.log("deleteing sockkettt2", callingsockets[i],socketId)
          callingsockets.splice(i, 1);
        }

      })
    }
    // targetSockets.forEach((socketId) => {
    //   for (let i = 0; i < callingsockets.length; i++) {
    //     console.log("taageettfesdadsa", socketId, callingsockets[i],current.socketId)
    //     if (callingsockets[i] === socketId ) {
    //       console.log("deleteing sockkettt", callingsockets[i])
    //       callingsockets.splice(i, 1);
    //     }
    //     if(callingsockets[i]===current.socketId){
    //       console.log("deleteing sockkettt", callingsockets[i])
    //       callingsockets.splice(i,1);
    //     }
    //   }
    // });
  });

  socket.on("group-call", async (data1, data2) => {
    //console.log("group-call", data1,data2);
    groupsoncall.push(data1.name);
    //console.log("data1,id", data1.id);
    const currentuser = users.get(socket.id);
    let sockets = [];

    //const group = await Group.findOne({ id: data1.id });
    try {
      // Find the group by your custom `id` field
      const group = await Group.findOne({ id: data1.id });

      if (!group) {
        console.error("Group not found with id:", data1.id);
        return; // Exit if the group doesn't exist
      }

      // Update the group, adding the current user to the `oncall` array
      const updatedGroup = await Group.findOneAndUpdate(
        { id: data1.id }, // Use `findOneAndUpdate` instead of `findByIdAndUpdate`
        { $addToSet: { oncall: currentuser.id } }, // Push current user ID into `oncall` array
        { new: true } // Return the updated document
      );

      // if (updatedGroup) {
      //   console.log("Updated group with new oncall user:", updatedGroup);
      // } else {
      //   console.error("Failed to update group with id:", data1.id);
      // }

      data1.members = updatedGroup.members;
    } catch (error) {
      console.error("Error updating oncall users:", error);
      return; // Exit early if there's an error
    }

    //data1.members = group.members;
    let availablesocket = [];
    //console.log("availablessssssssssssss", data1.members);

    for (let j = 0; j < data1.members.length; j++) {
      let check = false;
      for (let i = 0; i < callingsockets.length; i++) {
        const user = users.get(callingsockets[i]);
        //console.log("calling socketsssss", user.id, data1.members[j])
        if (user && data1.members[j] == user.id) {
          check = true;
          //console.log("calling socketsssssinnnn", user.id, data1.members[j])
        }
      }
      if (!check) {
        availablesocket.push(data1.members[j]);
      }
    }

    data1.members = availablesocket;
    //console.log("dddaaaaatttaa11groudpttttttttttttttttttttttttttttttttttt", availablesocket);
    //console.log("cuureeenntuser", currentuser);
    for (let i = 0; i < data1.members.length; i++) {
      const userToCall = Array.from(users.values())
        .reverse()
        .find(
          (user) => user.id === data1.members[i] && user.id != currentuser.id
        );
      //console.log("usertocall", userToCall);
      sockets.push(userToCall);
    }
    //console.log("socketssss",sockets);
    sockets.forEach((socket) => {
      //console.log("socketsforeach",socket);
      if (socket) {
        io.to(socket.socketId).emit("group-call-incoming", {
          signal: data2,
          from: currentuser.id,
          useroncall: currentuser,
          data: data1,
        });
        //io.to(socket.socketId).emit("group-call-incoming",data1.members,currentuser.socketId);
      }
    });
    // if (userToCall) {

    // }
  });
  socket.on("member-call", async (data1, data2, member) => {
    let currentuser = users.get(socket.id);
    //console.log("member-data", data2.data.members, data1, member);

    let sockets = [];
    //console.log("cuureeenntuser", currentuser);
    // for(let i=0;i<data2.data.members.length;i++){

    try {
      // Find the group by your custom `id` field
      const group = await Group.findOne({ id: data2.data.id });

      if (!group) {
        console.error("Group not found with id:", data2.data.id);
        return; // Exit if the group doesn't exist
      }

      // Update the group, adding the current user to the `oncall` array
      const updatedGroup = await Group.findOneAndUpdate(
        { id: data2.data.id }, // Use `findOneAndUpdate` instead of `findByIdAndUpdate`
        { $addToSet: { oncall: currentuser.id } }, // Push current user ID into `oncall` array
        { new: true } // Return the updated document
      );

      // if (updatedGroup) {
      //   console.log("Updated group with new oncall user:", updatedGroup);
      // } else {
      //   console.error("Failed to update group with id:", data1.id);
      // }

      //data2.members = updatedGroup.members;
    } catch (error) {
      console.error("Error updating oncall users:", error);
      return; // Exit early if there's an error
    }

    const userToCall = Array.from(users.values())
      .reverse()
      .find((user) => user.id === member);
    //console.log("usertocall", userToCall);
    sockets.push(userToCall);
    // }
    //console.log("socketsssss", sockets);
    sockets.forEach((socket) => {
      //console.log("socketsforeach",socket);
      if (socket) {
        io.to(socket.socketId).emit("member-call-incoming", {
          signal: data1,
          from: currentuser.id,
          useroncall: currentuser,
          data: data2,
        });
        //console.log("dddddddddddddddddddd", socket);
        //io.to(socket.socketId).emit("group-call-incoming",data1.members,currentuser.socketId);
      }
    });
  });

  socket.on("join-group-call", async (data1, data2, member) => {
    let currentuser = users.get(socket.id);
    //console.log("member-data", data1, data2, member);

    let sockets = [];
    //console.log("cuureeenntuser", currentuser);
    // for(let i=0;i<data2.data.members.length;i++){

    try {
      // Find the group by your custom `id` field
      const group = await Group.findOne({ id: data2.id });

      if (!group) {
        console.error("Group not found with id:", data2.id);
        return; // Exit if the group doesn't exist
      }

      // Update the group, adding the current user to the `oncall` array
      const updatedGroup = await Group.findOneAndUpdate(
        { id: data2.id }, // Use `findOneAndUpdate` instead of `findByIdAndUpdate`
        { $addToSet: { oncall: currentuser.id } }, // Push current user ID into `oncall` array
        { new: true } // Return the updated document
      );

      // if (updatedGroup) {
      //   console.log("Updated group with new oncall user:", updatedGroup);
      // } else {
      //   console.error("Failed to update group with id:", data1.id);
      // }

      //data2.members = updatedGroup.members;
    } catch (error) {
      console.error("Error updating oncall users:", error);
      return; // Exit early if there's an error
    }

    const userToCall = Array.from(users.values())
      .reverse()
      .find((user) => user.id === member);
    //console.log("usertocall", userToCall);
    sockets.push(userToCall);
    // }
    //console.log("socketsssss", sockets);
    sockets.forEach((socket) => {
      //console.log("socketsforeach",socket);
      if (socket) {
        io.to(socket.socketId).emit("member-call-incoming", {
          signal: data1,
          from: currentuser.id,
          useroncall: currentuser,
          data: data2,
        });
        //console.log("dddddddddddddddddddd", socket);
        //io.to(socket.socketId).emit("group-call-incoming",data1.members,currentuser.socketId);
      }
    });
  });
  socket.on("group-call-declined", async()=>{
    const user= users.get(socket.id);
    const groupList = await Group.find({ members: { $in: user.id } });
    io.to(socket.id).emit("group list", groupList);
    //removeOnCallUser(1,2,socket.id);
  })

  socket.on("disconnect", async () => {
    const user = users.get(socket.id);
    if (user) {
      console.log("User disconnected:", user.username);
      users.delete(socket.id);

      try {
        // Find all groups where the user is currently on call
        const groupsWithUserOnCall = await Group.find({ oncall: user.id });

        if (groupsWithUserOnCall.length === 0) {
          console.log(`User ${user.id} is not on call in any group`);
          return;
        }

        // Iterate through each group and remove the user from `oncall`
        for (const group of groupsWithUserOnCall) {
          await Group.findOneAndUpdate(
            { id: group.id },
            { $pull: { oncall: user.id } }, // Remove the user from `oncall`
            { new: true }
          );
          console.log(
            `Removed user ${user.id} from oncall in group ${group.id}`
          );
        }
      } catch (error) {
        console.error("Error during user disconnect:", error);
      }
      // await User.deleteOne({ id: user.id });
      // await updateUserList(user.parentId);
    }
    users.delete(socket.id);
  });
});

const PORT = process.env.PORT;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

