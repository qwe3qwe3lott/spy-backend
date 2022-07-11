import {v4 as uuidv4} from 'uuid';
import {Member} from '../types/member.type';
import {Logger} from '@nestjs/common';
import {Server} from 'socket.io';
import {IDeletableRoom} from '../interfaces/deletable-room.interface';
import {Flow} from '../entities/flow.entity';
import {GamePlayer} from './game-player.abstract';
import {RoomState} from '../types/room-state.type';
import {User} from '../types/user.type';
import {GameEvents} from '../enums/game-events.enum';
import {LogRecord} from '../types/log-record.type';
import {GameRoomOptions} from '../types/game-room-options.type';
import {randomElement} from '../util/random-element.util';

export abstract class GameRoom<PLAYER extends GamePlayer, STATE extends RoomState<PLAYER>, STATUS extends string, OPTIONS extends GameRoomOptions> implements IDeletableRoom {
    protected static readonly ADDITIONAL_NICKNAME_CHAR = ')'
    protected readonly _id: string; public get id() { return this._id; }
    protected readonly _logger: Logger
    protected _owner: Member | null
    protected _members: Member[]
    private get membersPayload() { return this._members.map(member => ({ isPlayer: member.isPlayer, nickname: member.user.nickname })); }
    protected get playersAmongMembers() { return this._members.filter(member => member.isPlayer); }
    protected _ownerKey: string | null
    protected readonly _server: Server
    protected get channel() { return this._server.to(this._id); }
    private _failedChecksCount: number
    protected readonly _flow: Flow
    protected _state?: STATE
    protected get currentPlayer() { return this._state.players[0]; }
    protected abstract get playersPayload(): unknown[]
    protected _status: STATUS
    protected abstract get isRunning()
    protected get isOnPause() { return this.isRunning && this._flow.notRunning; }
    protected abstract get restrictionsToStart(): string[]
    protected _options: OPTIONS

    protected constructor(server: Server) {
    	this._server = server;
    	this._id = uuidv4();
    	this._status = 'idle' as STATUS;
    	this._owner = null;
    	this._ownerKey = uuidv4();
    	this._members = [];
    	this._failedChecksCount = 0;
    	this._logger = new Logger(`Room ${this._id}`);
    	this._flow = new Flow();
    	this.applyOptions(this.getDefaultOptions());
    }

    protected abstract getDefaultOptions(): OPTIONS
    protected abstract applyOptions(options: OPTIONS): void

    public checkActivity(): boolean {
    	if (this._members.length <= 0) {
    		if (this.isRunning) {
    			this._status = 'idle' as STATUS;
    			this._flow.stop();
    		}
    	}
    	return this._members.length > 0;
    }
    public increaseFailedChecksCount(): number { return ++this._failedChecksCount; }
    public abstract delete(): void

    protected nextCurrentPlayer() { this._state.players.push(this._state.players.shift()); }

    public abstract start(ownerKey: string): void
    public abstract stop(ownerKey: string): void
    public abstract pause(ownerKey: string): void
    public abstract resume(ownerKey: string): void

    public abstract join(user: User): boolean

    public changeNickname(user: User, nickname: string): string {
    	if (this.isRunning) return '';
    	while (this._members.some(member => member.user.nickname === nickname)) nickname += GameRoom.ADDITIONAL_NICKNAME_CHAR;
    	user.nickname = nickname;
    	this.sendMembersToAll();
    	return nickname;
    }

    public setOptions(options: OPTIONS, ownerKey: string): boolean {
    	if (this.isRunning) return false;
    	if (this._ownerKey !== ownerKey) return false;
    	this.applyOptions(options);
    	this.sendOptionsToAll();
    	this.sendRestrictionsToStartToUser(this._owner.user.id);
    	return true;
    }

    protected checkRejoin(user: User): PLAYER | undefined {
    	if (this.playersAmongMembers.length >= this._state.players.length) return;
    	for (const player of this._state.players) {
    		if (user.nickname === player.nickname) return player;
    	}
    }

    public become(user: User, becomePlayer: boolean): boolean {
    	this._logger.log(`EVENT: User ${user.id} tries to become ${becomePlayer ? 'player' : 'spectator'}`);
    	if (this.isRunning) {
    	    this._logger.log('FAIL: game is running');
    	    return false;
    	}
    	const member = this._members.find(member => member.user.id === user.id);
    	if (!member) {
    		this._logger.log('FAIL: user was not found in members list');
    	    return false;
    	}
    	member.isPlayer = becomePlayer;
    	this._logger.log(`SUCCESS: User ${user.id} became ${becomePlayer ? 'player' : 'spectator'}`);
    	this.sendMembersToAll();
    	this.sendRestrictionsToStartToUser(this._owner.user.id);
    	return true;
    }

    public kick(user: User): void {
    	this._logger.log(`User ${user?.id} leaving`);
    	if (!user) return;
    	this._members = this._members.filter(member => member.user.id !== user.id);
    	if (this._members.length === 0) {
    		this._owner = null;
    		this._ownerKey = null;
    	} else if (user.id === this._owner.user.id) {
    		this._owner = randomElement(this._members);
    		this._ownerKey = uuidv4();
    		this.sendOwnerKeyToUser(this._owner.user.id);
    		this.sendRestrictionsToStartToUser(this._owner.user.id);
    	} else {
    		this.sendRestrictionsToStartToUser(this._owner.user.id);
    	}
    	user.socket.leave(this._id);
    	this.sendMembersToAll();
    	this._logger.log(`User ${user.id} left`);
    }

    public requestOptions(user: User): void {
    	if (!user) return;
    	this.sendOptionsToUser(user.id);
    }

    public requestTimer(user: User): void {
    	if (!this.isRunning || !user) return;
    	this.sendTimerToUser(user.id);
    }

    protected sendMembersToAll() { this.channel.emit(GameEvents.GET_MEMBERS, this.membersPayload); }
    protected sendMembersToUser(userId: string) { this._server.to(userId).emit(GameEvents.GET_MEMBERS, this.membersPayload); }

    protected sendLogsToAll() { this.channel.emit(GameEvents.GET_ALL_LOG_RECORDS, this._state.logs); }
    protected sendLogsToUser(userId: string) { this._server.to(userId).emit(GameEvents.GET_ALL_LOG_RECORDS, this._state.logs); }

    protected sendLogRecordToAll(record: LogRecord) { this.channel.emit(GameEvents.GET_LOG_RECORD, record); }

    protected sendPlayersToAll() { this.channel.emit(GameEvents.GET_PLAYERS, this.playersPayload); }
    protected sendPlayersToUser(userId: string) { this._server.to(userId).emit(GameEvents.GET_PLAYERS, this.playersPayload); }

    protected sendTimerToAll() { this.channel.emit(GameEvents.GET_TIMER, this._flow.timer); }
    protected sendTimerToUser(userId: string) { this._server.to(userId).emit(GameEvents.GET_TIMER, this._flow.timer); }

    protected sendRoomStatusToAll() { this.channel.emit(GameEvents.GET_ROOM_STATUS, this._status); }
    protected sendRoomStatusToUser(userId: string) { this._server.to(userId).emit(GameEvents.GET_ROOM_STATUS, this._status); }

    protected sendActFlagToAll(flag: boolean) { this.channel.emit(GameEvents.GET_ACT_FLAG, flag); }
    protected sendActFlagToUser(userId: string, flag: boolean) { this._server.to(userId).emit(GameEvents.GET_ACT_FLAG, flag); }

    protected sendPauseFlagToAll() { this.channel.emit(GameEvents.GET_PAUSE_FLAG, this.isOnPause); }
    protected sendPauseFlagToUser(userId: string) { this._server.to(userId).emit(GameEvents.GET_PAUSE_FLAG, this.isOnPause); }

    protected sendRestrictionsToStartToUser(userId: string) { this._server.to(userId).emit(GameEvents.GET_RESTRICTIONS_TO_START, this.restrictionsToStart); }

    protected sendOwnerKeyToUser(userId: string) { this._server.to(userId).emit(GameEvents.GET_OWNER_KEY, this._ownerKey); }

    protected sendNicknameToUser(userId: string, nickname: string, force: boolean) { this._server.to(userId).emit(GameEvents.GET_NICKNAME, { nickname, force }); }

    protected sendOptionsToAll() { this.channel.emit(GameEvents.GET_ROOM_OPTIONS, this._options); }
    protected sendOptionsToUser(userId: string) { this._server.to(userId).emit(GameEvents.GET_ROOM_OPTIONS, this._options); }
}