const fs = require("fs");
const fluentFfmpeg = require("fluent-ffmpeg");
const ffmpegStatic = require("ffmpeg-static");

// Tell fluent-ffmpeg where it can find FFmpeg
fluentFfmpeg.setFfmpegPath(ffmpegStatic);
const stream = require("stream");
const OpenAI = require("openai");
const ytdl = require("ytdl-core");
require("dotenv").config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const createTranscription = async (fileName) => {
  const transcription = await openai.audio.transcriptions.create({
    file: fs.createReadStream(fileName),
    model: "whisper-1",
    response_format: "srt",
  });
  return transcription;
};

const extractType = (blob) => {
  const type = blob.type;
  const slashIndex = type.indexOf("/");

  if (slashIndex !== -1 && slashIndex < type.length - 1) {
    return type.substr(slashIndex + 1);
  }
  return null;
};

const deleteAudios = async (filePaths) => {
  await Promise.all(
    filePaths.map(async (filePath) => {
      try {
        await fs.promises.unlink(filePath);
        console.log(`Archivo eliminado: ${filePath}`);
      } catch (error) {
        console.log(`Error al eliminar el archivo ${filePath}:`, error);
      }
    })
  );
};

const processChunk = async (chunkBlob, i) => {
  const audioArrayBuffer = await chunkBlob.arrayBuffer();
  const outputFileName = `audio_${i}.mp3`;

  return new Promise((resolve, reject) => {
    const audioStream = new stream.Readable({
      read() {
        const buffer = Buffer.from(audioArrayBuffer);
        this.push(buffer);
        this.push(null);
      },
    });

    fluentFfmpeg(audioStream)
      .toFormat("mp3")
      .on("start", (commandLine) => {
        console.log("FFmpeg iniciado con el comando: " + commandLine);
      })
      .on("error", (err) => {
        console.log("Se produjo un error: " + err.message);
        reject(err);
      })
      .on("end", () => {
        console.log(`Procesamiento finalizado para ${outputFileName}`);
        resolve(outputFileName);
      })
      .save(outputFileName);
  });
};

const audioFileToBlob = async (audioFilePath) => {
  return new Promise((resolve, reject) => {
    fs.readFile(audioFilePath, (err, data) => {
      if (err) {
        reject(err);
        return;
      }

      const blob = new Blob([data], { type: "audio/mp3" });
      resolve(blob);
    });
  });
};

const convertToMp3 = async (stream, filePath) => {
  return new Promise((resolve, reject) => {
    fluentFfmpeg()
      .input(stream)
      .toFormat("mp3")
      .output(filePath)
      .on("end", () => {
        console.log("Conversion successful");
        resolve(filePath);
      })
      .on("error", (err) => {
        console.error("Error with ffmpeg", err);
        reject("Error with ffmpeg");
      })
      .run();
  });
};

const download = (videoLink) => {
  const video = ytdl(videoLink, { filter: "audioonly" });
  return video;
};

const videoToAudio = async (video, user) => {
  const audioArrayBuffer = await video.arrayBuffer();
  const audioStream = new stream.Readable({
    read() {
      const buffer = Buffer.from(audioArrayBuffer);
      this.push(buffer);
      this.push(null);
    },
  });
  const outputFileName = `onlyaudio-${user}.mp3`;
  return new Promise((resolve, reject) => {
    fluentFfmpeg(audioStream)
      .toFormat("mp3")
      .on("start", (commandLine) => {
        console.log("FFmpeg iniciado con el comando: " + commandLine);
      })
      .on("error", (err) => {
        console.log("Se produjo un error: " + err.message);
        reject("Error with ffmpeg");
      })
      .on("end", () => {
        console.log(`Procesamiento finalizado para ${outputFileName}`);
        resolve(outputFileName);
      })
      .save(outputFileName);
  });
};

module.exports = {
  createTranscription,
  extractType,
  deleteAudios,
  processChunk,
  audioFileToBlob,
  convertToMp3,
  download,
  videoToAudio,
};
