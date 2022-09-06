# PWA Network Client

This repository contains a Progressive Web Application ([PWA](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps), delivery method, runtime model)
using the Direct Sockets API ([DSA](https://github.com/WICG/direct-sockets/), network API)
and Go code compile to WebAssembly ([WASM](https://developer.mozilla.org/en-US/docs/WebAssembly), platform independent compilation target)
to provide client bootstrapping ([SCB](https://github.com/netsec-ethz/bootstrapper/), zeroconf mechanism).

Inspired by the [NTP polling demo](https://direct-sockets-ntp.glitch.me/) (client sends raw UDP datagrams with a payload consisting of a 48 byte array with byte 0 set to 27).

