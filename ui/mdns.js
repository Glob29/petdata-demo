'use strict';

/*
 * Мини-ответчик mDNS: объявляет имя вида korma.local → IP этого компьютера.
 *
 * Зачем: чтобы открывать базу как http://korma.local:8790/ с телефона и ноутбука,
 * не помня цифровой адрес и не настраивая DNS-сервер. mDNS — это zero-config:
 * устройства в одной сети спрашивают «кто такой korma.local?» широковещательно,
 * и мы отвечаем своим IP. Роутер и DNS-сервер не нужны.
 *
 * Ограничения:
 *   - .local понимают iPhone/iPad, macOS, Android (частично), Linux, Windows 10+;
 *   - старые Windows и некоторые приложения могут не спросить — тогда работает IP.
 *
 * Без внешних зависимостей: dgram + ручная сборка DNS-пакетов.
 */

const dgram = require('node:dgram');
const net = require('node:net');
const os = require('node:os');

const MDNS_PORT = 5353;
const MDNS_ADDRESS = '224.0.0.251';

/*
 * IP в локальной сети. Первый не-internal интерфейс может оказаться виртуальным
 * (VirtualBox, VPN), поэтому спрашиваем у системы адрес, с которого идёт маршрут наружу.
 */
function lanAddress() {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '8.8.8.8', port: 53 });
    const done = (address) => {
      socket.destroy();
      resolve(address || fallbackAddress());
    };
    socket.setTimeout(1500);
    socket.on('connect', () => done(socket.localAddress));
    socket.on('timeout', () => done(socket.localAddress));
    socket.on('error', () => done(null));
  });
}

function fallbackAddress() {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const item of list || []) {
      if (item.family === 'IPv4' && !item.internal && !item.address.startsWith('192.168.56.')) return item.address;
    }
  }
  return null;
}

// «korma.local» → байты DNS-имени (метки с длиной).
function encodeName(name) {
  return Buffer.concat(
    name
      .split('.')
      .filter(Boolean)
      .map((label) => {
        const buffer = Buffer.from(label, 'utf8');
        return Buffer.concat([Buffer.from([buffer.length]), buffer]);
      })
      .concat([Buffer.from([0])])
  );
}

// Читаем QNAME из вопроса: возвращаем имя и смещение после него.
function decodeName(buffer, offset) {
  const labels = [];
  let cursor = offset;
  while (cursor < buffer.length) {
    const length = buffer[cursor];
    if (length === 0) {
      cursor += 1;
      break;
    }
    if (length > 63) break; // сжатие в вопросах не встречается
    labels.push(buffer.subarray(cursor + 1, cursor + 1 + length).toString('utf8'));
    cursor += 1 + length;
  }
  return { name: labels.join('.').toLowerCase(), offset: cursor };
}

function buildAnswer(query, ip) {
  const header = Buffer.alloc(12);
  header.writeUInt16BE(0, 0); // ID: 0 для mDNS
  header.writeUInt16BE(0x8400, 2); // QR=1, AA=1
  header.writeUInt16BE(0, 4); // QDCOUNT
  header.writeUInt16BE(1, 6); // ANCOUNT
  header.writeUInt16BE(0, 8);
  header.writeUInt16BE(0, 10);

  // Имя берём из вопроса: 0xC00C — указатель на QNAME в начале пакета.
  const answer = Buffer.alloc(12);
  answer.writeUInt16BE(0xc00c, 0);
  answer.writeUInt16BE(1, 2); // TYPE A
  answer.writeUInt16BE(0x8001, 4); // CLASS IN + cache-flush
  answer.writeUInt32BE(120, 6); // TTL 120 c
  answer.writeUInt16BE(4, 10); // RDLENGTH
  const ipBuffer = Buffer.from(ip.split('.').map(Number));
  return Buffer.concat([header, answer, ipBuffer]);
}

async function startMdns({ hostname, ip, log = console.log }) {
  const ipAddress = ip || (await lanAddress());
  if (!ipAddress) {
    log('[mdns] не найден локальный IPv4 — имя не объявляю');
    return null;
  }

  const names = new Set(
    [hostname, hostname.endsWith('.local') ? hostname : `${hostname}.local`].map((value) => value.toLowerCase())
  );

  const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

  socket.on('error', (error) => {
    log(`[mdns] ошибка сокета: ${error.message} (имя ${hostname}.local недоступно, IP работает)`);
    try {
      socket.close();
    } catch {
      // уже закрыт
    }
  });

  socket.on('message', (message, remote) => {
    try {
      if (message.length < 12) return;
      const flags = message.readUInt16BE(2);
      if (flags & 0x8000) return; // это ответ, не вопрос
      const questions = message.readUInt16BE(4);
      if (!questions) return;

      let offset = 12;
      for (let i = 0; i < questions; i += 1) {
        const { name, offset: afterName } = decodeName(message, offset);
        if (afterName + 4 > message.length) return;
        const type = message.readUInt16BE(afterName);
        offset = afterName + 4;

        if (names.has(name)) {
          log(`[mdns] запрос ${name} от ${remote.address}:${remote.port} (type ${type})`);
        }
        if ((type === 1 || type === 255) && names.has(name)) {
          // По RFC 6762: если запрос пришёл не с порта 5353 — отвечаем unicast прямо отправителю,
          // иначе в multicast. Иначе простые клиенты ответ не увидят.
          const quBit = (message.readUInt16BE(afterName + 2) & 0x8000) !== 0;
          const unicastOnly = remote.port !== MDNS_PORT || quBit;
          setTimeout(() => {
            try {
              const answer = buildAnswer(message, ipAddress);
              if (unicastOnly) {
                socket.send(answer, remote.port, remote.address);
              } else {
                socket.setMulticastInterface(ipAddress);
                socket.send(answer, MDNS_PORT, MDNS_ADDRESS);
                // Дубль лично отправителю: некоторые роутеры не пропускают multicast между клиентами.
                socket.send(answer, remote.port, remote.address);
              }
            } catch {
              // сеть могла измениться — не критично
            }
          }, 20);
        }
      }
    } catch {
      // битый пакет игнорируем
    }
  });

  socket.bind(MDNS_PORT, () => {
    try {
      // Интерфейс указываем явно: у ПК их несколько (Wi-Fi + виртуальные),
      // и по умолчанию multicast может уйти не в ту сеть, где телефон.
      socket.addMembership(MDNS_ADDRESS, ipAddress);
      socket.setMulticastInterface(ipAddress);
      socket.setMulticastTTL(255);
      socket.setMulticastLoopback(true);
    } catch (error) {
      log(`[mdns] не удалось войти в multicast-группу: ${error.message}`);
    }
    log(`[mdns] имя ${hostname}.local → ${ipAddress} (интерфейс ${ipAddress})`);
  });

  return socket;
}


module.exports = { startMdns, lanAddress };
