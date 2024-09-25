import { io } from 'socket.io-client';
const socket =io.connect("https://chat-plugin-pa4u.onrender.com")
export default socket
