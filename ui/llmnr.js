'use strict';

/*
 * LLMNR-ответчик: Windows резолвит короткие имена (korma) через LLMNR,
 * спрашивая multicast на 224.0.0.252:5355. Отвечаем unicast.
 *
 * Формат ответа важен: Windows принимает его только если в пакете есть
 * секция вопроса (QDCOUNT=1) и ответ ссылается на неё указателем 0xC00C.
 * Ответ без вопроса выглядит как «неверный пакет DNS».
 */

const dgram = require('node:dgram');

function decodeName(buffer, offset) {
  const labels = [];
  let cursor = offset;
  while (cursor < buffer.length) {
    const length = buffer[cursor];
    if (length === 0) { cursor += 1; break; }
    if (length > 63) break;
    labels.push(buffer.subarray(cursor + 1, cursor + 1 + length).toString('utf8'));
    cursor += 1 + length;
  }
  return { name: labels.join('.').toLowerCase(), offset: cursor };
}

function startLlmnr({ hostname, ip, log = console.log }) {
  const target = String(hostname).toLowerCase();
  const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

  socket.on('error', (error) => {
    log(`[llmnr] ошибка сокета: ${error.message} (имя ${hostname} недоступно, IP работает)`);
    try {
      socket.close();
    } catch {
      // уже закрыт
    }
  });

  socket.on('message', (message, remote) => {
    try {
      if (message.length < 12) return;
      if (message.readUInt16BE(2) & 0x8000) return; // это ответ
      if (message.readUInt16BE(4) < 1) return;

      const { name, offset } = decodeName(message, 12);
      if (offset + 4 > message.length) return;
      const type = message.readUInt16BE(offset);
      if (type !== 1 || name !== target) return;

      const questionEnd = offset + 4;
      const question = message.subarray(12, questionEnd);

      const header = Buffer.alloc(12);
      header.writeUInt16BE(message.readUInt16BE(0), 0); // ID как в запросе
      header.writeUInt16BE(0x8000, 2); // QR=1
      header.writeUInt16BE(1, 4); // QDCOUNT — вопрос эхом
      header.writeUInt16BE(1, 6); // ANCOUNT
      header.writeUInt16BE(0, 8);
      header.writeUInt16BE(0, 10);

      const answerHead = Buffer.alloc(10);
      answerHead.writeUInt16BE(0xc00c, 0); // указатель на QNAME
      answerHead.writeUInt16BE(1, 2); // TYPE A
      answerHead.writeUInt16BE(1, 4); // CLASS IN
      answerHead.writeUInt32BE(30, 6); // TTL 30 c
      const ipBuffer = Buffer.from(ip.split('.').map(Number));
      const rdataLength = Buffer.alloc(2);
      rdataLength.writeUInt16BE(4, 0);

      const response = Buffer.concat([header, question, answerHead, rdataLength, ipBuffer]);
      socket.send(response, remote.port, remote.address);
    } catch {
      // битый пакет игнорируем
    }
  });

  socket.bind(5355, () => {
    try {
      // Явно слушаем multicast на сетевом интерфейсе, а не на виртуальном.
      socket.addMembership('224.0.0.252', ip);
      socket.setMulticastInterface(ip);
    } catch {
      // не критично
    }
    log(`[llmnr] имя ${hostname} → ${ip} (для Windows)`);
  });

  return socket;
}

module.exports = { startLlmnr };

