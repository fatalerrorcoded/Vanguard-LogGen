const { exec } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

let indexSaved = undefined;

const logFolder = "logs";
if (!fs.existsSync(logFolder)) fs.mkdirSync(logFolder);

const saveDxdiag = (savepath) => {
    return new Promise((resolve, reject) => {
        exec(`"%systemroot%\\system32\\dxdiag.exe" /t "${savepath}"`, (error, stdout, stderr) => {
            if (error) {
                reject(`Exec error: ${error}`);
                return;
            }
            console.log("Saved dxdiag");
            resolve();
        });
    });
}

const saveProcesses = (savepath) => {
    return new Promise((resolve, reject) => {
        exec("tasklist /v", (error, stdout, stderr) => {
            if (error) {
                reject(`Exec error: ${error}`);
                return;
            }

            fs.writeFile(savepath, stdout, (error) => {
                if (error) {
                    reject(`Save error: ${error}`);
                    return;
                }

                console.log("Saved processes");
                resolve();
            });
        });
    });
}

const saveNetworkInfo = (savepath) => {
    return new Promise((resolve, reject) => {
        exec("ipconfig /all & ping www.google.com & netsh firewall show config & netsh interface ipv4 show subinterfaces & netsh interface ipv4 show ipstats", (error, stdout, stderr) => {
            if (error) {
                reject(`Exec error: ${error}`);
                return;
            }

            fs.writeFile(savepath, stdout, (error) => {
                if (error) {
                    reject(`Save error: ${error}`);
                    return;
                }

                console.log("Saved network info");
                resolve();
            });
        });
    });
}

const saveLogGenInfo = async (savepath, eventLogIndex) => {
    let info = "";
    if (eventLogIndex) info += `These logs were automatically generated at ${new Date().toString()} after a vgc crash was detected\n`;
    else info += `These logs were manually generated at ${new Date().toString()}\n`;

    info += `Generated using https://github.com/fatalerrorcoded/Vanguard-LogGen`;

    if (eventLogIndex) {
        let powershellInfo = await (() => new Promise((resolve, reject) => {
            exec(`PowerShell.exe "Get-EventLog -LogName System -Index ${eventLogIndex} | Select-Object Data,EntryType,Message,Source,TimeGenerated"`, (error, stdout, stderr) => {
                if (error) {
                    reject(`Exec error: ${error}`);
                    return;
                }
                resolve(stdout);
            });
        }))();

        info += "\n\n";
        info += "The following info was reported from the event log\n";
        info += powershellInfo;
    }

    await fs.writeFile(savepath, info);
    console.log("Saved loggen info");
}

const saveLogs = (saveDirectory, eventLogIndex) => {
    console.log(`Saving logs to ${saveDirectory}`);
    return Promise.all([
        saveDxdiag(path.join(saveDirectory, "Riot dxdiag.txt")),
        saveProcesses(path.join(saveDirectory, "Riot Process.txt")),
        saveNetworkInfo(path.join(saveDirectory, "Riot NetworkInfo.txt")),
        saveLogGenInfo(path.join(saveDirectory, "LogGen Info.txt"), eventLogIndex)
    ]);
}

if (process.argv[2] !== undefined) {
    switch (process.argv[2].toLowerCase()) {
        case "/watch":
        case "--watch":
            setInterval(() => {
                exec('PowerShell.exe Get-EventLog -Newest 1 -LogName System', (error, stdout, stderr) => {
                    if (error) {
                        console.error(`Exec error: ${error}`);
                        return;
                    }
                    let secondLine = stdout.split("\n")[3];
                    let index = secondLine.substring(3);
                    index = index.substring(0, index.indexOf(" "));
                    if (indexSaved !== index) {
                        if (secondLine.indexOf("vgc") !== -1 && indexSaved !== undefined) {
                            console.log("Vanguard crashed, collecting logs");
        
                            const logSpecificFolder = path.join(logFolder, index);
                            fs.mkdir(logSpecificFolder).then(() => saveLogs(logSpecificFolder, index));
                        }
                        indexSaved = index;
                    }
                    });
            }, 5000);
        
            console.log("Watching the vgc service");
            break;
        default:
            console.log("Usage: node src/index.js [--watch]");
            break;
    }
} else {
    const logSpecificFolder = path.join(logFolder, "manual");
    fs.mkdir(logSpecificFolder).then(() => saveLogs(logSpecificFolder, undefined));
}
