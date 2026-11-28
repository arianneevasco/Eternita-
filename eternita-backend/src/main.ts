import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { spawn } from "child_process";
import path from "path";


function loadPrologAccessRules(): Promise<void> {
  return new Promise((resolve, reject) => {
    const prologFilePath = path.resolve(
      __dirname,
      "../prolog/access_rules.pl"
    );

    const prolog = spawn("swipl", [
      "-q",
      "-f",
      prologFilePath,
      "-g",
      "halt"
    ]);

    prolog.on("error", (error) => {
      reject(new Error(`Failed to start SWI-Prolog: ${error.message}`));
    });

    prolog.on("exit", (code) => {
      if (code === 0) {
        console.log("Prolog access rules loaded successfully.");
        resolve();
      } else {
        reject(
          new Error(
            `Prolog access rules failed to load. SWI-Prolog exit code: ${code}`
          )
        );
      }
    });
  });
}

async function startServer() {
  try {
    await loadPrologAccessRules();

    console.log("Eternita backend is starting.");

    // Keep your existing server startup code here.
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

startServer();