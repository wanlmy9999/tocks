// websocket.gateway.ts
import {
  WebSocketGateway, WebSocketServer,
  SubscribeMessage, MessageBody, ConnectedSocket,
  OnGatewayConnection, OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import axios from 'axios';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/realtime',
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(RealtimeGateway.name);
  private subscriptions = new Map<string, Set<string>>(); // symbol → socketIds
  private intervals = new Map<string, NodeJS.Timeout>(); // symbol → interval

  handleConnection(socket: Socket) {
    this.logger.log(`Client connected: ${socket.id}`);
  }

  handleDisconnect(socket: Socket) {
    this.logger.log(`Client disconnected: ${socket.id}`);
    // Remove from all subscriptions
    this.subscriptions.forEach((sockets, symbol) => {
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        this.stopStream(symbol);
      }
    });
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(@MessageBody() data: { symbol: string }, @ConnectedSocket() socket: Socket) {
    const { symbol } = data;
    if (!symbol) return;

    const sym = symbol.toUpperCase();
    if (!this.subscriptions.has(sym)) {
      this.subscriptions.set(sym, new Set());
      this.startStream(sym);
    }
    this.subscriptions.get(sym)!.add(socket.id);
    socket.join(`quote:${sym}`);
    this.logger.log(`${socket.id} subscribed to ${sym}`);
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(@MessageBody() data: { symbol: string }, @ConnectedSocket() socket: Socket) {
    const sym = data.symbol?.toUpperCase();
    if (!sym) return;
    this.subscriptions.get(sym)?.delete(socket.id);
    socket.leave(`quote:${sym}`);
    if (this.subscriptions.get(sym)?.size === 0) {
      this.stopStream(sym);
    }
  }

  private startStream(symbol: string) {
    const interval = setInterval(async () => {
      try {
        const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`;
        const res = await axios.get(url, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          timeout: 5000,
        });
        const q = res.data?.quoteResponse?.result?.[0];
        if (q) {
          this.server.to(`quote:${symbol}`).emit('quote', {
            symbol,
            price: q.regularMarketPrice,
            change: q.regularMarketChange,
            changePct: q.regularMarketChangePercent,
            volume: q.regularMarketVolume,
            timestamp: Date.now(),
          });
        }
      } catch (err) {
        this.logger.debug(`Quote stream error for ${symbol}: ${err.message}`);
      }
    }, 5000);
    this.intervals.set(symbol, interval);
  }

  private stopStream(symbol: string) {
    const interval = this.intervals.get(symbol);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(symbol);
      this.subscriptions.delete(symbol);
    }
  }
}

// websocket.module.ts
import { Module } from '@nestjs/common';

@Module({ providers: [RealtimeGateway] })
export class WebsocketModule {}
