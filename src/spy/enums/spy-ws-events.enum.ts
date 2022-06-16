export enum SpyWSEvents {
    CREATE_ROOM = 'createRoom',
    CHECK_ROOM = 'checkRoom',
    JOIN_ROOM = 'joinRoom',
    LEAVE_ROOM = 'leaveRoom',
    START_GAME = 'startGame',
    STOP_GAME = 'stopGame',
    PAUSE_GAME = 'pauseGame',
    RESUME_GAME = 'resumeGame',
    CHANGE_NICKNAME = 'changeNickname',
    BECOME = 'become',
    MOVE_CARDS = 'moveCards',
    REQUEST_TIMER = 'requestTimer',
    REQUEST_ROOM_OPTIONS = 'requestRoomOptions',
    CAPTURE_CARD = 'captureCard',
    ASK_CARD = 'askCard',
    CHANGE_ROOM_OPTIONS = 'changeRoomOptions',
    GET_OWNER_KEY = 'getOwnerKey',
    GET_MEMBERS = 'getMembers',
    GET_NICKNAME = 'getNickname',
    GET_RUNNING_FLAG = 'getRunningFlag',
    GET_PAUSE_FLAG = 'getPauseFlag',
    GET_ACT_FLAG = 'getActFlag',
    GET_FIELD_CARDS = 'getFieldCards',
    GET_SIZES = 'getSizes',
    GET_PLAYERS = 'getPlayers',
    GET_START_CONDITION_FLAG = 'getStartConditionFlag',
    GET_TIMER = 'getTimer',
    GET_CARD = 'getCard',
    GET_ALL_LOG_RECORDS = 'getAllLogRecords',
    GET_LOG_RECORD = 'getLogRecord',
    GET_ACT_CARD_IDS = 'getActCardIds',
    GET_LAST_WINNER = 'getLastWinner',
    GET_ROOM_OPTIONS = 'getRoomOptions'
}