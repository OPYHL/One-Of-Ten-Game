export function connect({ onState, onEvent, onTimer } = {}) {
  const sock = new SockJS('/ws');
  const stomp = Stomp.over(sock);
  stomp.debug = () => {};
  const api = {
    send: (dest, body = {}) => stomp.send(dest, {}, JSON.stringify(body)),
    isConnected: () => connected,
  };
  let connected = false;

  stomp.connect({}, () => {
    connected = true;
    if (onState) stomp.subscribe('/topic/state', m => onState(JSON.parse(m.body)));
    if (onEvent) stomp.subscribe('/topic/events', m => onEvent(JSON.parse(m.body)));
    if (onTimer) stomp.subscribe('/topic/timer',  m => onTimer(JSON.parse(m.body)));
  });

  return api;
}
