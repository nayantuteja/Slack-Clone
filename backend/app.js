import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";
import { ExpressPeerServer } from "peer";
import dotenv from "dotenv";
import { Socket } from "dgram";
const activeGroupCalls = new Map();

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
const mongoURI =
  "mongodb+srv://nayantuteja:00hofBhyJnOOx5Mr@cluster0.ov6sp.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
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
        //users.delete(xsocketid);
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
    console.log("user removed", groupId, userId);
    try {
      console.log("ussssserrr rerreemmoovveedd");
      const group = await Group.findOne({ id: groupId });
      const allUsers = dummyEmployees.employees
        .filter((emp) => emp.parent_id === group.parentId)
        .map((emp) => ({
          id: emp.catcher_id,
          username: emp.name,
          userType: emp.type_id === 1 ? "employer" : "sub-employee",
        }));
      console.log("removed group&& users", group.createdBy, socket.userId);

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
          console.log("valuesid", values, keys);
          if (values.id === userId) {
            removedSocketIds.push(keys); // Push the key into the array if the condition is met
          }
        });
        console.log("removed users", removedSocketIds);
        //io.to(removedsocketid).emit("removed from group", groupId);
        removedSocketIds.forEach((socketId) => {
          console.log("USER REMOVER", socketId, groupId);
          io.to(socketId).emit("removed from group", groupId);
        });

        console.log(`User ${userId} removed from group ${groupId}`);
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
    // console.log("messagedata", messageData);
    //console.log("userssss", users);
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
    //console.log("Message saved:", newMessage);

    if (chatId.startsWith("group-")) {
      const groupId = chatId.split("group-")[1];
      const group = groups.get(groupId);
      //console.log("groups", groups, group);

      if (
        group &&
        group.members.includes(sender.id) &&
        group.parentId === sender.parentId
      ) {
        group.members.forEach((memberId) => {
          const member = Array.from(users.values()).find(
            (u) => u.id === memberId
          );
          const members = Array.from(users.values()).filter(
            (u) => u.id === memberId
          );
          if (members.length > 0) {
            members.forEach((member) => {
              if (member.socketId) {
                io.to(member.socketId).emit("chat message", messageData);
              }
            });
          } else {
            if (member && member.socketId) {
              io.to(member.socketId).emit("chat message", messageData);
            }
          }
          //console.log("group-menber", member);
        });
      }
    } else if (chatId === `employer-${sender.parentId}`) {
      io.to(chatId).emit("chat message", messageData);
    } else if (receiver) {
      const receiverSocket = Array.from(users.values()).find(
        (user) => user.id === receiver && user.parentId === sender.parentId
      )?.socketId;

      //console.log("uuuuusss", users);
      const receiverSockets = Array.from(users.values())
        .filter((user) => user.id === receiver)
        .map((user) => user.socketId);
      //console.log("sssennnderrr", sender);
      const senderSockets = Array.from(users.values())
        .filter((user) => user.id === sender.id)
        .map((user) => user.socketId);

      //console.log("seeeendeerr", senderSockets, receiverSockets);
      if (receiverSockets.length > 0) {
        receiverSockets.forEach((socketId) => {
          io.to(socketId).emit("chat message", messageData);
        });
        senderSockets.forEach((socketId) => {
          io.to(socketId).emit("chat message", messageData);
        });
        // Sending the message to the sender as well
        //console.log("sendersockets", senderSockets);
        //io.to(socket.id).emit("chat message", messageData);
      } else {
        // console.log("receiversocekt", receiverSocket, users);
        // console.log("recdeiver", receiver);
        if (receiverSocket) {
          io.to(receiverSocket).emit("chat message", messageData);
          io.to(socket.id).emit("chat message", messageData);
        }
      }
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
  console.log("usrs",users)
  //console.log("data", data);
  const { useroncall, signalData } = data;
  console.log("usersonccall", useroncall);
  if (useroncall&&useroncall.id) {

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
    io.to(data.to).emit("call-accepted", data.signal);
  });

  socket.on("end-call", (targetUserId) => {
    //console.log("targetuserid", targetUserId, users);
    const targetSockets = Array.from(users.values())
    .filter((user) => user.id === targetUserId) // Find all users that match the condition
    .map((user) => user.socketId); // Extract their socketIds

  // Emit to each socketId that satisfies the condition
  targetSockets.forEach((socketId) => {
    io.to(socketId).emit("call-ended", socket.id);
  });
  });

  socket.on("disconnect", async () => {
    const user = users.get(socket.id);
    if (user) {
      console.log("User disconnected:", user.username);
      users.delete(socket.id);
      // await User.deleteOne({ id: user.id });
      // await updateUserList(user.parentId);
    }
  });
});

const PORT = process.env.PORT;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
