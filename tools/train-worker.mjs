// Hilo de simulación: recibe {id,mode,g,cls,secs,sd} y devuelve el fitness de esa partida.
import { parentPort } from "node:worker_threads";
import { run } from "./train.mjs";
parentPort.on("message", j => parentPort.postMessage({ id: j.id, f: run(j.mode, j.g, j.cls, j.secs, j.sd).fitness }));
