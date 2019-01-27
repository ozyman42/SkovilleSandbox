import {WebpackDevSecOps} from './index';
import express from 'express';
import mime from 'mime';
import http from 'http';
import socketio from 'socket.io';
import {SOCKET_MESSAGE_EVENT} from './api-model';

const TEMP_COMPILER_ID = "web";

export class WebpackDevSecOpsServer {

    private server: http.Server;
    private sockets: socketio.Socket[];

    public constructor(port: number) {
        this.sockets = [];
        const app = express();
        app.get("*", async (req, res, next) => {
            const stream = await WebpackDevSecOps.getReadStream(TEMP_COMPILER_ID, req.path === "/" ? "/index.html" : req.path);
            if(!stream) return next();
            res.setHeader("Content-Type", mime.getType(req.path));
            stream.pipe(res);
        });
        this.server = new http.Server(app);
        const io = socketio(this.server);
        io.on('connection', socket => {
            io.to(socket.id).emit(SOCKET_MESSAGE_EVENT, WebpackDevSecOps.getUpdateStrategyMessage(TEMP_COMPILER_ID));
            io.to(socket.id).emit(SOCKET_MESSAGE_EVENT, WebpackDevSecOps.getLatestUpdateMessage(TEMP_COMPILER_ID));
            this.sockets.push(socket);
            socket.on("disconnect", () => {
                const index = this.sockets.indexOf(socket);
                if(index !== -1) this.sockets.splice(index, 1);
                socket.disconnect(true);
            });
        });
        this.server.listen(port, () => {
            console.log("listening");
        });
        WebpackDevSecOps.hooks.onServerMessage.tap(
            WebpackDevSecOps.name,
            (id, message) => {
                // Will want to end up using the socket.io emitted boolean to tell what clients are up to date and which are behind.
                this.sockets.forEach(socket => {io.to(socket.id).emit(SOCKET_MESSAGE_EVENT, message);});
            }
        );
    }

    public close(cb: Function) {
        this.sockets.forEach(socket => socket.disconnect(true));
        this.sockets = [];
        this.server.close(() => {
            cb();
        });
    }

}

// Sometimes sockets will disconnect and we need to make sure that they receive the messages they missed.
// Thus each SocketManager can keep track of which message in the queue they have seen.
class SocketManager {

    public constructor() {

    }

}