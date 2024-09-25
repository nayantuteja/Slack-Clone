// frontend/utils/socket.js
import { io } from "socket.io-client";
const socket = io("https://chat-plugin-majn.onrender.com"); // Ensure this URL matches your backend server
export default socket;
