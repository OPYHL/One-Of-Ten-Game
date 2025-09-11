// /js/ws.js  (ES module)
export function connect(handlers){
  const sock = new SockJS('/ws');
  const stomp = Stomp.over(sock);
  stomp.debug = null;

  const api = {
    send: (dest, body) => stomp.connected && stomp.send(dest, {}, JSON.stringify(body||{}))
  };

  stomp.connect({}, () => {
    stomp.subscribe('/topic/state',  m => handlers.onState && handlers.onState(JSON.parse(m.body)));
    stomp.subscribe('/topic/events', m => handlers.onEvent && handlers.onEvent(JSON.parse(m.body)));
    stomp.subscribe('/topic/timer',  m => handlers.onTimer && handlers.onTimer(JSON.parse(m.body)));

    // poproś o snapshot po połączeniu (display i player to robią)
    api.send('/app/requestState', {});
  });

  return api;
}
