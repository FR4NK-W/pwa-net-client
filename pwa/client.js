// --- HELPERS ---
const cleanMessage = (svc) => {
  let errorMsg = document.querySelector("#msg_"+svc.toLowerCase());
  if (!errorMsg) return;
  errorMsg.innerHTML = "";
  errorMsg.classList.remove("success_msg");
  errorMsg.classList.remove("error_msg");
};

const displayErrorMsg = (svc, text) => {
  cleanMessage(svc);
  let errorMsg = document.querySelector("#msg_"+svc.toLowerCase());
  if (!errorMsg) return;
  errorMsg.innerHTML = text;
  errorMsg.classList.remove("success_msg");
  errorMsg.classList.add("error_msg");
};

const displaySuccessMsg = (svc, text) => {
  cleanMessage(svc);
  let successMsg = document.querySelector("#msg_"+svc.toLowerCase());
  if (!successMsg) return;
  successMsg.innerHTML = text;
  successMsg.classList.remove("error_msg");
  successMsg.classList.add("success_msg");
};

const toggle = id => {
  var h = document.getElementById(id);
  if (h.className == 'hidden') {
    h.style='display: block;';
    h.classList.remove('hidden');
  } else {
    h.style='display: none;';
    h.classList.add('hidden');
  }
}

const versionHint = () => {
  var n = navigator["userAgent"];
  var hint = document.getElementById("version_hint");
  try {
    var majorVersion = n.slice(n.indexOf("Chrom"), n.length).split(" ", 1)[0].split("/", 2)[1].split(".", 1)[0];
    if (100 <= majorVersion && 102 >= majorVersion) {
      hint.classList.add('green');
    } else {
      hint.classList.add('error_msg');
    }
  } catch {
    console.log(n);
    hint.classList.add('error_msg');
  }
}

const domainHint = () => {
  var domain = window.location.hostname;
  var hint = document.getElementById("domain_hint");
  hint.innerHTML = domain;
}

const pwaCheck = () => {
  var hint = document.getElementById("pwa_check");
  if (window.matchMedia('(display-mode: standalone)').matches) {
    hint.classList.add('green');
  } else {
      hint.classList.add('error_msg');
  }
}

const test = async () => {
  const data = "";
  console.log(data);
  alert(data);
}


const ntpPollBtn = document.querySelector("#ntp_poll_btn");
const ntpPollStopBtn = document.querySelector("#ntp_poll_stop_btn");

const dnsQueryBtn = document.querySelector("#dns_query_btn");

const scbQueryBtn = document.querySelector("#scb_query_btn");

const addTrigger = (e, service, action) => {
  e.addEventListener("click", async e => {
    if (!socketAvailable(service)) {
      return;
    }

    if (inUse) {
      displayErrorMsg(service, 'There\'s already an open UDP connection. Close it before starting a new one.');
      return;
    }

    inUse = true;

    const [host, port] = document.querySelector("#host_port_"+service.toLowerCase()).value.split(':');
    action(service, host, port);
  });
}

// --- Direct Socket API ---

let udpSocket = undefined;
let inUse = false;

let reader = undefined;

const socketAvailable = (svc) => {
  if (typeof UDPSocket == "undefined") {
    displayErrorMsg(svc, "Did you (re)launch Chromium with the required flag? Check that the flag --isolated-app-origins=https://domain is set.");
    document.getElementById("get_help").click();
    return false;
  }
  return true;
}

const createNTPPayload = () => {
  const data = new Uint8Array(48);
  data[0] = 27;
  return data;
};

const parseNTPPayload = (data) => {
  console.log(Array.apply([], data.slice(40, 44)).join(", "));
  const secondsSince19000101 = (new DataView(data.slice(40, 44).buffer)).getUint32();
  const date = new Date(new Date(1900, 1, 1) - new Date(1970, 1, 1) + secondsSince19000101 * 1000);
  return date;
};

const processNTPPayload = (remoteAddress, remotePort, date) => {
  displaySuccessMsg('NTP', `NTP server at ${remoteAddress}:${remotePort} <br/>replied with current local time:<br/> ${date.toString()}.`);
  return false;
}

const processDNSPayload = (remoteAddress, remotePort, query, IP) => {
  displaySuccessMsg('DNS', `DNS server at ${remoteAddress}:${remotePort} <br/>resolved the IP address for the <br/>domain ${query} to ${IP.toString()}.`);
  return true;
}

const processSCBPayload = async (remoteAddress, remotePort, query, scb_server) => {
  let successMsg = document.querySelector("#msg_scb");
  if (!successMsg) return;
  if (!successMsg.innerHTML.startsWith("Opened ")) {
    return true;
  }
  if (scb_server == '') {
    displayErrorMsg(service, `Invalid bootstrapping server: "${scb_server}"`);
    return true;
  }
  successMsg.classList.remove("success_msg");
  const response = await fetch('https://'+scb_server+':8041/topology', {mode: 'cors', });
  var formattedJSON=JSON.stringify(JSON.parse(await response.text()), null, 2);
  successMsg.innerHTML='<pre>'+formattedJSON.replaceAll("\n", "<br/>")+'</pre>';
  await new Promise(r => setTimeout(r, 1000));
  return true;
}

const sendDatagram = async (writer, createPayload) => {
  if (!inUse) {
    return { value: undefined, done: true }
  }
  await writer.ready;
  const result = await writer.write({
    data: createPayload()
  }).then(() => true, err => {
    console.log(err); 
    return false; 
  });

  if (!result) {
    console.log('Write request returned an error, exiting...');
    return;
  }
};

const receiveDatagram = async (reader, service, parsePayload, processPayload) => {
  while (true) {
    if (!inUse) {
      return { value: undefined, done: true }
    }
    const { value, done } = await reader.read().catch(err => { 
      console.log(err); 
      inUse = false; 
      return { value: undefined, done: true }
    });
    if (done) {
      await new Promise(r => setTimeout(r, 5000));
      console.log('Readable stream exhaused.');
      displaySuccessMsg(service, `No longer listening for replies from ${service} server.`);
      await new Promise(r => setTimeout(r, 3000));
      cleanMessage(service);
      return;
    }
    const { data } = value;
    const payload = parsePayload(data);
    completed = processPayload(payload);
    if (completed) {
      await new Promise(r => setTimeout(r, 5000));
      displaySuccessMsg(service, `Done processing replies from ${service} server.`);
      await new Promise(r => setTimeout(r, 3000));
      cleanMessage(service);
      return;
    }
  }
};

async function doPolling(service, host, port, createPayload, parsePayload, processPayload) {
  try {
    udpSocket = new UDPSocket(host, parseInt(port));
    await udpSocket.opened;
  } catch (err) {
    displayErrorMsg(service, `opening UDPSocket failed: ${err}.\nGet some help.`);
    document.getElementById("get_help").click();
    inUse = false;
    return;
  }

  const { readable, writable, remoteAddress, remotePort } = await udpSocket.connection;

  displaySuccessMsg(service, `Opened UDP connection to ${service} server at ${remoteAddress}:${remotePort}.`);

  await new Promise(r => setTimeout(r, 1000));

  const writer = writable.getWriter();
  reader = readable.getReader();
  receiveDatagram(reader, service, parsePayload, processPayload);
  while (true) {
    if (!inUse) {
      break;
    }
    sendDatagram(writer, createPayload);
    await new Promise(r => setTimeout(r, 1000));
  }
};

async function doOneshot(service, host, port, createPayload, parsePayload, processPayload) {
  try {
    udpSocket = new UDPSocket(host, parseInt(port));
    await udpSocket.opened;
  } catch (err) {
    displayErrorMsg(service, `opening UDPSocket failed: ${err}.\nGet some help.`);
    document.getElementById("get_help").click();
    inUse = false;
    return;
  }

  const { readable, writable, remoteAddress, remotePort } = await udpSocket.connection;

  displaySuccessMsg(service, `Opened UDP connection to ${service} server at ${remoteAddress}:${remotePort}.`);

  await new Promise(r => setTimeout(r, 1000));

  const writer = writable.getWriter();
  reader = readable.getReader();
  sendDatagram(writer, createPayload);
  await new Promise(r => setTimeout(r, 500));
  receiveDatagram(reader, service, parsePayload, processPayload);
  await new Promise(r => setTimeout(() => {
    inUse = false;
    udpSocket.close({ force: true });
    udpSocket = undefined;
    reader = undefined;
  }, 1000));
};

if (ntpPollBtn) {
  action = (service, host, port) =>
    doPolling(service,
              host,
              port,
              go.GenerateNTPPayload,
              go.ParseNTPPayload,
              (date) => processNTPPayload(host, port, date)
    );
  addTrigger(ntpPollBtn, "NTP", action);
}

if (ntpPollStopBtn) {
  ntpPollStopBtn.addEventListener("click", async e => {
    if (!inUse) {
      return;
    }

    inUse = false;
    udpSocket.close({ force: true });
    udpSocket = undefined;
    reader = undefined;
  });
}

if (dnsQueryBtn) {
  action = (service, host, port) =>
    doOneshot(service,
              host,
              port,
              () => go.GenerateDNSPayload("ethz.ch"),
              go.ParseDNSPayload,
              (ip) => processDNSPayload(host, port, "ethz.ch", ip)
    );
  addTrigger(dnsQueryBtn, "DNS", action);
}

if (scbQueryBtn) {
  action = (service, host, port) =>
    doOneshot(service,
              host,
              port,
              () => go.GenerateSCBPayload("ethz.ch"),
              go.ParseSCBPayload,
              (scb_server) => processSCBPayload(host, port, "ethz.ch", scb_server)
    );
  addTrigger(scbQueryBtn, "SCB", action);
}
