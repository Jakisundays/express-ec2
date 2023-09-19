const express = require("express");
const multer = require("multer");
const {
  audioFileToBlob,
  processChunk,
  createTranscription,
} = require("../utils/audioHelpers");
const { Readable } = require("stream"); // Import the Readable class
const upload = multer({
  storage: multer.diskStorage({
    destination: "uploads/",
    filename: (req, file, callback) => {
      // Rename the file here
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const originalname = file.originalname;
      const extension = originalname.split(".").pop(); // Get the file extension
      const newFileName = `uploaded_file_${uniqueSuffix}.${extension}`;
      callback(null, newFileName);
    },
  }),
});
const router = express.Router();

// Define a POST route
router.post("/stream", upload.single("audio"), async (req, res) => {
  const { file } = req;
  const { path } = file;
  try {
    const audioBlob = await audioFileToBlob(path);
    const cuantosMB = 2;
    const CHUNK_SIZE = cuantosMB * 1024 * 1024;
    const chunkBlobs = [];
    let start = 0;

    while (start < audioBlob.size) {
      const end = Math.min(start + CHUNK_SIZE, audioBlob.size);
      const chunkBlob = new Blob([audioBlob.slice(start, end)], {
        type: audioBlob.type,
      });
      chunkBlobs.push(chunkBlob);
      start = end;
    }

    // const processedFiles = await Promise.all(chunkBlobs.map(processChunk));

    // console.log({ processedFiles });
    // Create a readable stream
    const stream = new Readable({
      async read() {
        // No es necesario ejecutar el bucle aquí
      },
    });

    async function processTranscriptions() {
      try {
        const processedFiles = await Promise.all(chunkBlobs.map(processChunk));

        console.log({ processedFiles });

        for (const filePath of processedFiles) {
          console.log({ filePath });
          const transcription = await createTranscription(filePath);
          stream.push(transcription); // Enviar datos de transcripción como JSON
        }

        stream.push(null); // Señal de fin del stream
      } catch (error) {
        console.log({ error });
        stream.emit("error", error); // Emitir un error en el stream si ocurre un error
      }
    }

    processTranscriptions(); // Llamar a la función para iniciar el proceso

    // Set the response headers for streaming JSON data
    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="transcriptions.json"'
    );

    // Pipe the stream to the response
    stream.pipe(res);
  } catch (error) {
    console.log({ error });
    res.status(500).send(error);
  }
});

module.exports = router;
