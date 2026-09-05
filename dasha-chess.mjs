const START = [
  'rnbqkbnr', 'pppppppp', '........', '........',
  '........', '........', 'PPPPPPPP', 'RNBQKBNR',
].join('');

const FILES = 'abcdefgh';
const PROMOTIONS = 'qrbn';

export const CHESS_START_RATING = 1200;
export const CHESS_CLOCK_MS = 10 * 60_000;
export const CHESS_INCREMENT_MS = 5_000;

export function squareIndex(square) {
  if (!/^[a-h][1-8]$/.test(String(square || ''))) return -1;
  return (8 - Number(square[1])) * 8 + FILES.indexOf(square[0]);
}

export function squareName(index) {
  return index >= 0 && index < 64 ? FILES[index % 8] + (8 - Math.floor(index / 8)) : '';
}

const colorOf = piece => !piece || piece === '.' ? null : piece === piece.toUpperCase() ? 'w' : 'b';
const enemy = color => color === 'w' ? 'b' : 'w';
const row = index => Math.floor(index / 8);
const col = index => index % 8;
const inside = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
const clone = state => ({ ...state, board: [...state.board], positions: { ...(state.positions || {}) }, moves: [...(state.moves || [])] });

export function positionKey(state) {
  const enPassant = state.enPassant != null && legalMoves(state).some(move => move.enPassant) ? squareName(state.enPassant) : '-';
  return `${state.board.join('')} ${state.turn} ${state.castling || '-'} ${enPassant}`;
}

export function newChessState() {
  const state = {
    board: [...START], turn: 'w', castling: 'KQkq', enPassant: null,
    halfmove: 0, fullmove: 1, moves: [], positions: {}, version: 0,
    status: 'active', result: null, reason: null,
  };
  state.positions[positionKey(state)] = 1;
  return state;
}

function attacked(state, target, by) {
  const b = state.board;
  const tr = row(target), tc = col(target);
  const pawnRow = tr + (by === 'w' ? 1 : -1);
  for (const dc of [-1, 1]) {
    const c = tc + dc;
    if (inside(pawnRow, c) && b[pawnRow * 8 + c] === (by === 'w' ? 'P' : 'p')) return true;
  }
  for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
    const r = tr + dr, c = tc + dc;
    if (inside(r, c) && b[r * 8 + c] === (by === 'w' ? 'N' : 'n')) return true;
  }
  for (const [dr, dc, kinds] of [[-1,0,'RQ'],[1,0,'RQ'],[0,-1,'RQ'],[0,1,'RQ'],[-1,-1,'BQ'],[-1,1,'BQ'],[1,-1,'BQ'],[1,1,'BQ']]) {
    for (let r = tr + dr, c = tc + dc; inside(r, c); r += dr, c += dc) {
      const piece = b[r * 8 + c];
      if (piece === '.') continue;
      if (colorOf(piece) === by && kinds.includes(piece.toUpperCase())) return true;
      break;
    }
  }
  const king = by === 'w' ? 'K' : 'k';
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (!dr && !dc) continue;
    const r = tr + dr, c = tc + dc;
    if (inside(r, c) && b[r * 8 + c] === king) return true;
  }
  return false;
}

export function inCheck(state, color = state.turn) {
  const king = state.board.indexOf(color === 'w' ? 'K' : 'k');
  return king < 0 || attacked(state, king, enemy(color));
}

function pushStep(state, moves, from, r, c) {
  if (!inside(r, c)) return false;
  const to = r * 8 + c, target = state.board[to], own = colorOf(state.board[from]);
  if (colorOf(target) !== own) moves.push({ from, to });
  return target === '.';
}

function pseudoMoves(state, from) {
  const b = state.board, piece = b[from], color = colorOf(piece);
  if (!color) return [];
  const kind = piece.toUpperCase(), r = row(from), c = col(from), moves = [];
  if (kind === 'P') {
    const dr = color === 'w' ? -1 : 1, start = color === 'w' ? 6 : 1, promotionRow = color === 'w' ? 0 : 7;
    const one = (r + dr) * 8 + c;
    if (inside(r + dr, c) && b[one] === '.') {
      if (r + dr === promotionRow) for (const promotion of PROMOTIONS) moves.push({ from, to: one, promotion });
      else moves.push({ from, to: one });
      const two = (r + dr * 2) * 8 + c;
      if (r === start && b[two] === '.') moves.push({ from, to: two });
    }
    for (const dc of [-1, 1]) {
      if (!inside(r + dr, c + dc)) continue;
      const to = (r + dr) * 8 + c + dc;
      if (colorOf(b[to]) === enemy(color) || to === state.enPassant) {
        if (r + dr === promotionRow) for (const promotion of PROMOTIONS) moves.push({ from, to, promotion, enPassant: to === state.enPassant });
        else moves.push({ from, to, enPassant: to === state.enPassant });
      }
    }
  } else if (kind === 'N') {
    for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) pushStep(state, moves, from, r + dr, c + dc);
  } else if (kind === 'B' || kind === 'R' || kind === 'Q') {
    const dirs = kind === 'B' ? [[-1,-1],[-1,1],[1,-1],[1,1]] : kind === 'R' ? [[-1,0],[1,0],[0,-1],[0,1]] : [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]];
    for (const [dr, dc] of dirs) for (let rr = r + dr, cc = c + dc; inside(rr, cc); rr += dr, cc += dc) if (!pushStep(state, moves, from, rr, cc)) break;
  } else if (kind === 'K') {
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (dr || dc) pushStep(state, moves, from, r + dr, c + dc);
    const kingHome = color === 'w' ? 60 : 4, foe = enemy(color);
    if (from === kingHome && !inCheck(state, color)) {
      const rights = state.castling || '';
      const kingside = color === 'w' ? 'K' : 'k', queenside = color === 'w' ? 'Q' : 'q';
      if (rights.includes(kingside) && b[from + 1] === '.' && b[from + 2] === '.' && b[from + 3] === (color === 'w' ? 'R' : 'r') && !attacked(state, from + 1, foe) && !attacked(state, from + 2, foe)) moves.push({ from, to: from + 2, castle: 'k' });
      if (rights.includes(queenside) && b[from - 1] === '.' && b[from - 2] === '.' && b[from - 3] === '.' && b[from - 4] === (color === 'w' ? 'R' : 'r') && !attacked(state, from - 1, foe) && !attacked(state, from - 2, foe)) moves.push({ from, to: from - 2, castle: 'q' });
    }
  }
  return moves;
}

function applyUnchecked(state, move) {
  const next = clone(state), piece = next.board[move.from], color = colorOf(piece), captured = next.board[move.to];
  next.board[move.from] = '.';
  next.board[move.to] = move.promotion ? (color === 'w' ? move.promotion.toUpperCase() : move.promotion) : piece;
  if (move.enPassant) next.board[move.to + (color === 'w' ? 8 : -8)] = '.';
  if (move.castle === 'k') { next.board[move.to - 1] = next.board[move.to + 1]; next.board[move.to + 1] = '.'; }
  if (move.castle === 'q') { next.board[move.to + 1] = next.board[move.to - 2]; next.board[move.to - 2] = '.'; }
  let rights = next.castling || '';
  if (piece === 'K') rights = rights.replace(/[KQ]/g, '');
  if (piece === 'k') rights = rights.replace(/[kq]/g, '');
  for (const [square, right] of [[63,'K'],[56,'Q'],[7,'k'],[0,'q']]) if (move.from === square || move.to === square) rights = rights.replace(right, '');
  next.castling = rights;
  next.enPassant = piece.toUpperCase() === 'P' && Math.abs(move.to - move.from) === 16 ? (move.to + move.from) / 2 : null;
  next.halfmove = piece.toUpperCase() === 'P' || captured !== '.' || move.enPassant ? 0 : next.halfmove + 1;
  if (color === 'b') next.fullmove++;
  next.turn = enemy(color);
  return next;
}

export function legalMoves(state, from = null) {
  if (!state || state.status !== 'active') return [];
  const moves = [];
  const start = from == null ? 0 : from, end = from == null ? 64 : from + 1;
  for (let index = start; index < end; index++) {
    if (colorOf(state.board[index]) !== state.turn) continue;
    for (const move of pseudoMoves(state, index)) if (!inCheck(applyUnchecked(state, move), state.turn)) moves.push(move);
  }
  return moves;
}

export function isDeadPosition(state) {
  const material = state.board.map((piece, index) => ({ piece, index })).filter(item => !'.Kk'.includes(item.piece));
  if (!material.length) return true;
  if (material.some(item => 'PpRrQq'.includes(item.piece))) return false;
  if (material.length === 1) return true;
  return material.every(item => item.piece.toUpperCase() === 'B') && new Set(material.map(item => (row(item.index) + col(item.index)) % 2)).size === 1;
}

export function canMate(state, color) {
  const own = state.board.map((piece, index) => ({ piece, index })).filter(item => colorOf(item.piece) === color && item.piece.toUpperCase() !== 'K');
  if (!own.length) return false;
  const opponent = state.board.filter(piece => colorOf(piece) === enemy(color) && piece.toUpperCase() !== 'K');
  if (own.length === 1 && own[0].piece.toUpperCase() === 'N' && opponent.every(piece => piece.toUpperCase() === 'Q')) return false;
  if (own.every(item => item.piece.toUpperCase() === 'B')) {
    const bishopColors = new Set(state.board.map((piece, index) => ({ piece, index })).filter(item => item.piece.toUpperCase() === 'B').map(item => (row(item.index) + col(item.index)) % 2));
    if (bishopColors.size < 2 && !opponent.some(piece => 'NP'.includes(piece.toUpperCase()))) return false;
  }
  return true;
}

function moveName(state, move, piece, captured, check, mate) {
  const kind = piece.toUpperCase(), suffix = mate ? '#' : check ? '+' : '';
  if (move.castle) return (move.castle === 'k' ? 'O-O' : 'O-O-O') + suffix;
  const capture = captured !== '.', from = squareName(move.from), to = squareName(move.to);
  let lead = kind === 'P' ? (capture ? from[0] : '') : kind;
  if (kind !== 'P') {
    const rivals = legalMoves(state).filter(other => other.to === move.to && other.from !== move.from && state.board[other.from].toUpperCase() === kind);
    if (rivals.length) lead += rivals.some(other => col(other.from) === col(move.from)) ? (rivals.some(other => row(other.from) === row(move.from)) ? from : from[1]) : from[0];
  }
  return `${lead}${capture ? 'x' : ''}${to}${move.promotion ? `=${move.promotion.toUpperCase()}` : ''}${suffix}`;
}

export function playMove(state, input, { now = Date.now() } = {}) {
  if (!state || state.status !== 'active') return { ok: false, status: 409, error: 'game is over' };
  const from = squareIndex(input?.from), to = squareIndex(input?.to), promotion = String(input?.promotion || 'q').toLowerCase();
  if (from < 0 || to < 0 || !PROMOTIONS.includes(promotion)) return { ok: false, status: 400, error: 'invalid move' };
  const options = legalMoves(state, from).filter(move => move.to === to);
  const move = options.find(option => !option.promotion || option.promotion === promotion);
  if (!move) return { ok: false, status: 400, error: 'illegal move' };
  const piece = state.board[from], captured = move.enPassant ? (state.turn === 'w' ? 'p' : 'P') : state.board[to];
  const next = applyUnchecked(state, move);
  next.version = (Number(state.version) || 0) + 1;
  const key = positionKey(next);
  next.positions[key] = (next.positions[key] || 0) + 1;
  const replies = legalMoves(next);
  const check = inCheck(next, next.turn);
  if (!replies.length) {
    next.status = 'finished';
    next.result = check ? (state.turn === 'w' ? '1-0' : '0-1') : '1/2-1/2';
    next.reason = check ? 'checkmate' : 'stalemate';
  } else if (next.halfmove >= 100) {
    next.status = 'finished'; next.result = '1/2-1/2'; next.reason = 'fifty-move rule';
  } else if (next.positions[key] >= 3) {
    next.status = 'finished'; next.result = '1/2-1/2'; next.reason = 'threefold repetition';
  } else if (isDeadPosition(next)) {
    next.status = 'finished'; next.result = '1/2-1/2'; next.reason = 'insufficient material';
  }
  const mate = next.reason === 'checkmate';
  next.moves.push({ from: squareName(from), to: squareName(to), ...(move.promotion ? { promotion: move.promotion } : {}), piece, ...(captured !== '.' ? { captured } : {}), san: moveName(state, move, piece, captured, check, mate), check, mate, at: now });
  return { ok: true, state: next, move: next.moves.at(-1) };
}

export function resignChess(state, color) {
  if (!state || state.status !== 'active' || !['w', 'b'].includes(color)) return { ok: false, status: 409, error: 'game is over' };
  const drawn = !canMate(state, enemy(color));
  return { ok: true, state: { ...clone(state), status: 'finished', result: drawn ? '1/2-1/2' : color === 'w' ? '0-1' : '1-0', reason: drawn ? 'resignation · no mating material' : 'resignation', version: (Number(state.version) || 0) + 1 } };
}

export function settleChessRatings(white = {}, black = {}, result) {
  const wr = Number(white.rating) || CHESS_START_RATING, br = Number(black.rating) || CHESS_START_RATING;
  const ws = result === '1-0' ? 1 : result === '0-1' ? 0 : 0.5, bs = 1 - ws;
  const expectedW = 1 / (1 + 10 ** ((br - wr) / 400));
  const nextW = Math.max(100, Math.round(wr + 24 * (ws - expectedW)));
  const nextB = Math.max(100, Math.round(br + 24 * (bs - (1 - expectedW))));
  const update = (row, rating, score) => ({ ...row, rating, games: (Number(row.games) || 0) + 1, wins: (Number(row.wins) || 0) + (score === 1 ? 1 : 0), losses: (Number(row.losses) || 0) + (score === 0 ? 1 : 0), draws: (Number(row.draws) || 0) + (score === 0.5 ? 1 : 0) });
  return { white: update(white, nextW, ws), black: update(black, nextB, bs) };
}

export function publicChessGame(game, viewerXId, now = Date.now()) {
  const side = game?.players?.w?.xId === String(viewerXId) ? 'w' : game?.players?.b?.xId === String(viewerXId) ? 'b' : null;
  if (!side) return null;
  let clock = null;
  if (game.clock) {
    const remaining = { w: Number(game.clock.w), b: Number(game.clock.b) };
    if (game.state.status === 'active') remaining[game.state.turn] = Math.max(0, remaining[game.state.turn] - Math.max(0, now - Number(game.clock.activeSince)));
    clock = { ...remaining, active: game.state.status === 'active' ? game.state.turn : null, serverNow: now, initialMs: CHESS_CLOCK_MS, incrementMs: CHESS_INCREMENT_MS };
  }
  return {
    id: game.id, side, status: game.state.status, result: game.state.result, reason: game.state.reason, rated: game.state.status !== 'finished' || Boolean(game.rated),
    board: game.state.board.join(''), turn: game.state.turn, castling: game.state.castling,
    check: Boolean(game.state.moves.at(-1)?.check),
    enPassant: game.state.enPassant == null ? null : squareName(game.state.enPassant),
    version: game.state.version, moves: game.state.moves,
    white: { handle: game.players.w.handle, rating: game.players.w.rating },
    black: { handle: game.players.b.handle, rating: game.players.b.rating },
    drawOffer: game.drawOfferBy ? (game.drawOfferBy === String(viewerXId) ? 'mine' : 'theirs') : null,
    rematchOffer: game.rematchOfferBy ? (game.rematchOfferBy === String(viewerXId) ? 'mine' : 'theirs') : null,
    rematchGameId: game.rematchGameId || null,
    legal: game.state.status === 'active' && game.state.turn === side
      ? legalMoves(game.state).map(move => ({ from: squareName(move.from), to: squareName(move.to), ...(move.promotion ? { promotion: move.promotion } : {}) }))
      : [],
    clock,
    createdAt: game.createdAt, updatedAt: game.updatedAt,
  };
}

export function publicChessReplay(game) {
  if (!game || game.state?.status !== 'finished') return null;
  let state = newChessState();
  const frames = [{ board: state.board.join(''), turn: state.turn, move: null }];
  for (const move of game.state.moves || []) {
    const at = Number(move.at), dated = Number.isFinite(at) && at > 0;
    const played = playMove(state, move, { now: dated ? at : 0 });
    if (!played.ok) return null;
    if (!dated) delete played.move.at;
    state = played.state;
    frames.push({ board: state.board.join(''), turn: state.turn, move: played.move });
  }
  return {
    id: game.id,
    result: game.state.result,
    reason: game.state.reason,
    white: { handle: game.players.w.handle, rating: game.players.w.rating },
    black: { handle: game.players.b.handle, rating: game.players.b.rating },
    frames,
    moves: state.moves,
    ...(game.tournamentId ? { tournamentId: game.tournamentId } : {}),
    finishedAt: game.finishedAt || game.updatedAt,
  };
}
