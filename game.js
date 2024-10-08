const canvas = document.getElementById("myCanvas");
const ctx = canvas.getContext("2d");
const audio = document.getElementById("gameAudio");
const WIDTH = 1280;
const HEIGHT = 720;
var notesArray = [];
const noteSpeed = 3.5; // Speed at which notes fall
const bpm = 128; // Beats per minute
const beatTime = 60 / bpm; // Time for one beat in seconds
const noteTypes = ["left", "up", "down", "right"];
const noteSize = 55; // Uniform size for square notes
const noteSpacing = 20; // Fixed separation between notes on X axis
const hitRange = 50; // Range within which a note is considered hit
const targetYPositionStart = 485; // New start of the hit zone
const targetYPositionEnd = 615; // End of the hit zone
// Early/Late and Perfect hit zones
const perfectRange = 15; // 10 pixels on either side for perfect hit
const targetYPosition = 600; // Y-position of stationary hit blocks
let streak = 0;
let maxStreak = 0;
let autoHitEnabled = false; // Flag to determine if auto-hit is enabled
let gameStarted = false; // Game state variable
let points = 0; // Initialize points
let recording = false; // To track if we're recording key presses
let recordedNotes = []; // Store recorded notes
let startTime; // Track game start time for recording
let customNotes = []; // Store custom notes for playback
let startRecordButton, stopRecordButton, autoHitButton, importButton, copyButton; // Buttons for recording, auto-hit, import, and copy
let lastRecordedNotes = []; // To store the last 3 recorded notes

// Track the state of highlighted stationary notes
const highlightedNotes = {
    left: false,
    up: false,
    down: false,
    right: false
};

// Track if a key is being held down for each note type
const keyHeldDown = {
    left: false,
    up: false,
    down: false,
    right: false
};

// Preload images
const images = {
    background: new Image(),
    note: {},
    notePress: {}
};

noteTypes.forEach((type) => {
    images.note[type] = new Image();
    images.notePress[type] = new Image();
    images.note[type].src = `Resources/Note${type}.png`;
    images.notePress[type].src = `Resources/Note${type}Press.png`;
});

// Preload discolored images for recorded notes
noteTypes.forEach((type) => {
    images.note[`rec${type}`] = new Image();
    images.note[`rec${type}`].src = `Resources/RecNote${type.charAt(0).toUpperCase() + type.slice(1)}.png`;
});

images.background.src = "Resources/starSystem.jpg";

// Set keybinds
const keyBindings = {
    A: "left",
    S: "up",
    K: "down",
    L: "right"
};

const noteXPositions = {
    left: WIDTH / 2 - 110,
    up: WIDTH / 2 - 37,
    down: WIDTH / 2 + 37,
    right: WIDTH / 2 + 110
};

// Reset button
const resetButton = document.createElement("button");
resetButton.innerText = "Reset Game";
resetButton.onclick = resetGame;
document.body.appendChild(resetButton);

// Note generator (for custom sequence or random)
function generateNotes(duration) {
    const beatInterval = beatTime * 1000; // Convert to milliseconds
    const numberOfNotes = Math.floor(duration / beatInterval); // Calculate the number of notes

    if (recording) {
        console.log("Recording mode: No random notes are generated.");
        return; // Skip note generation if recording
    }

    if (customNotes.length > 0) {
        console.log("Playing custom recorded notes.");
        // Generate notes based on recorded custom notes
        customNotes.forEach((note) => {
            setTimeout(() => {
                if (gameStarted) {
                    notesArray.push({
                        type: note.type,
                        y: -78,
                        x: noteXPositions[note.type] // Position based on custom X coordinates
                    });
                }
            }, note.timestamp); // Use the recorded timestamp
        });
    } else {
        console.log("Generating random notes.");
        // Generate random notes
        let noteCounter = 0;
        const noteGenerationInterval = setInterval(() => {
            if (gameStarted) {
                const noteType = noteTypes[Math.floor(Math.random() * noteTypes.length)];
                notesArray.push({
                    type: noteType,
                    y: -60,
                    x: noteXPositions[noteType] // Position based on custom X coordinates
                });

                noteCounter++;
                if (noteCounter >= numberOfNotes) {
                    clearInterval(noteGenerationInterval); // Stop generating notes when duration is reached
                }
            }
        }, beatInterval);
    }
}

function drawNotes() {
    ctx.drawImage(images.background, 0, 0, canvas.width, canvas.height);

    // Draw stationary hit blocks
    noteTypes.forEach((type) => {
        const x = noteXPositions[type];
        const imageToDraw = highlightedNotes[type] ? images.notePress[type] : images.note[type];
        ctx.drawImage(imageToDraw, x, 550, noteSize, noteSize);
    });

    // Draw falling notes, including recorded "fake" notes
    notesArray.forEach((note) => {
        // Check if it's a recorded note with discolored image
        const noteImage = note.type.startsWith("rec") ? images.note[note.type] : images.note[note.type.replace("rec", "")];
        ctx.drawImage(noteImage, note.x, note.y, noteSize, noteSize);
    });

    // Draw points on canvas
    ctx.fillStyle = "white";
    ctx.textAlign = "left";
    ctx.font = "24px Arial";
    ctx.fillText(`points: ${points}`, 10, 30); // Display points

    // Current + Max streak
    ctx.font = "30px Arial";
    ctx.textAlign = "center";
    ctx.fillText(streak, WIDTH / 2, HEIGHT / 2 - 120);
    ctx.font = "15px Arial";
    ctx.fillText(maxStreak, WIDTH / 2, HEIGHT / 2 - 160);

    // Display "Recording Notes" if recording
    if (recording) {
        ctx.fillStyle = "red";
        ctx.font = "30px Arial";
        ctx.fillText("Recording Notes", canvas.width / 2 - 100, 50); // Display text in the middle of the canvas
    }

    // Display the last 3 recorded notes
    if (lastRecordedNotes.length > 0) {
        ctx.fillStyle = "yellow";
        ctx.font = "18px Arial";
        ctx.textAlign = "left";

        // Reverse the array to display most recent note at the top
        const reversedNotes = [...lastRecordedNotes].reverse();

        reversedNotes.forEach((note, index) => {
            ctx.fillText(note, 10, 60 + index * 20); // Display each note below the previous one
        });
    }
}

function startRecording() {
    recording = true;
    console.log("Recording started.");
    recordedNotes = []; // Clear any previous recording
    lastRecordedNotes = []; // Clear recent notes display
    localStorage.removeItem("recordedNotes"); // Clear saved notes in localStorage
    resetGame(); // Automatically reset the game when recording starts
    startTime = Date.now(); // Reset start time for accurate timestamps

    // Hide start button, show stop button
    startRecordButton.style.display = "none";
    stopRecordButton.style.display = "inline-block";
}

// Function to stop recording and save notes
function stopRecording() {
    recording = false;
    console.log("Recording stopped.");

    // Save recorded notes to localStorage
    localStorage.setItem("recordedNotes", JSON.stringify(recordedNotes));
    console.log("Saved notes:", recordedNotes);

    // Show start button, hide stop button
    startRecordButton.style.display = "inline-block";
    stopRecordButton.style.display = "none";
}

// Maps for encoding and decoding note types
const noteTypeMap = { left: "L", down: "D", up: "U", right: "R" };
const reverseNoteTypeMap = { L: "left", D: "down", U: "up", R: "right" };

// Encode the notes into a compact format
function encodeNotes(notes) {
    return notes
        .map((note) => {
            const typeChar = noteTypeMap[note.type];
            return `${typeChar}/${note.timestamp}`; // Encoding as "TypeChar-Time"
        })
        .join(",");
}

// Decode the compact format back into an array of notes
function decodeNotes(encodedNotes) {
    return encodedNotes.split(",").map((noteStr) => {
        const [typeChar, timeStr] = noteStr.split("/");
        return { type: reverseNoteTypeMap[typeChar], timestamp: parseInt(timeStr) }; // Parse time as integer
    });
}

// Function to check if a string is a valid JSON array
function isValidJSONArray(str) {
    try {
        const parsed = JSON.parse(str);
        return Array.isArray(parsed);
    } catch (e) {
        return false;
    }
}

// Import notes from clipboard, detect format (custom encoded or regular array)
async function importNotes() {
    try {
        const clipboardText = await navigator.clipboard.readText();

        if (isValidJSONArray(clipboardText)) {
            // If it's valid JSON and an array, treat it as a regular notes array
            const notesArray = JSON.parse(clipboardText);
            customNotes = notesArray;
            localStorage.setItem("recordedNotes", JSON.stringify(notesArray));
            console.log("Imported notes (array format):", notesArray);
        } else if (clipboardText.includes("/")) {
            // Treat it as an encoded notes string
            const decodedNotes = decodeNotes(clipboardText);
            customNotes = decodedNotes;
            localStorage.setItem("recordedNotes", JSON.stringify(decodedNotes));
            console.log("Imported notes (encoded format):", decodedNotes);
        } else {
            console.error("Clipboard data is not in a recognized format.");
        }

        // Show confirmation popup
        window.alert("Notes imported successfully.");
    } catch (err) {
        console.error("Failed to read clipboard data:", err);
    }
}

// Copy recorded notes to clipboard in the custom encoded format
function copyNotesToClipboard() {
    const savedNotes = localStorage.getItem("recordedNotes");
    if (!savedNotes) {
        window.alert("No custom notes found in localStorage. Record some!");
        return;
    }

    const notes = JSON.parse(savedNotes);
    const encodedNotes = encodeNotes(notes); // Encode the notes into the custom format

    navigator.clipboard
        .writeText(encodedNotes)
        .then(() => {
            console.log("Copied notes to clipboard in encoded format:", encodedNotes);
        })
        .catch((err) => {
            console.error("Failed to copy notes to clipboard:", err);
        });
}

// Toggle auto-hit mode
function toggleAutoHit() {
    autoHitEnabled = !autoHitEnabled;
    console.log(`Auto-hit ${autoHitEnabled ? "enabled" : "disabled"}.`);
}

// Reset the game
function resetGame() {
    gameStarted = false; // Stop the game
    audio.pause(); // Pause audio
    audio.currentTime = 0; // Reset audio
    notesArray = []; // Clear notes array
    points = 0; // Reset points
    customNotes = []; // Clear custom notes

    // Load recorded notes for the next game
    const savedNotes = localStorage.getItem("recordedNotes");
    if (savedNotes) {
        customNotes = JSON.parse(savedNotes);
        console.log("Loaded saved notes from localStorage:", customNotes);
    } else {
        console.log("No saved notes found. Using random notes.");
    }

    // Automatically start the game again with saved notes
    startGame();
}

// Create buttons
window.onload = function () {
    // Create Start Recording button
    startRecordButton = document.createElement("button");
    startRecordButton.innerText = "Start Recording";
    startRecordButton.onclick = startRecording;
    document.body.appendChild(startRecordButton);

    // Create Stop Recording button (hidden by default)
    stopRecordButton = document.createElement("button");
    stopRecordButton.innerText = "Stop Recording";
    stopRecordButton.style.display = "none"; // Hidden initially
    stopRecordButton.onclick = stopRecording;
    document.body.appendChild(stopRecordButton);

    // Create Auto-Hit button
    autoHitButton = document.createElement("button");
    autoHitButton.innerText = "Auto-Hit";
    autoHitButton.onclick = toggleAutoHit;
    document.body.appendChild(autoHitButton);

    // Create Import Notes button
    importButton = document.createElement("button");
    importButton.innerText = "Import Notes";
    importButton.onclick = importNotes;
    document.body.appendChild(importButton);

    // Create Copy Notes button
    copyButton = document.createElement("button");
    copyButton.innerText = "Copy Notes";
    copyButton.onclick = copyNotesToClipboard;
    document.body.appendChild(copyButton);
};

// Update the `keydown` event handler to store the last 3 recorded notes
document.addEventListener("keydown", (event) => {
    const noteType = keyBindings[event.key.toUpperCase()];
    if (event.key === "Enter" && !gameStarted) {
        resetGame(); // Start the game when Enter is pressed
    } else if (gameStarted && noteType && !keyHeldDown[noteType]) {
        if (recording) {
            // Record the key press with timestamp if recording
            const timestamp = Date.now() - startTime - 1100; // Subtract 1000ms (1 second) from the timestamp
            recordedNotes.push({
                type: noteType,
                timestamp: timestamp
            });

            // Update the last recorded notes for display
            lastRecordedNotes.push(`Recorded: ${noteType}, at ${timestamp}ms`);
            if (lastRecordedNotes.length > 10) {
                lastRecordedNotes.shift(); // Keep only the last 10 entries
            }

            // Add a "fake" discolored note when recording
            notesArray.push({
                type: `rec${noteType}`, // Use discolored version
                y: 550, // Spawn at the y position of the stationary notes
                x: noteXPositions[noteType] // X position based on note type
            });

            console.log(`Recorded note: ${noteType} at ${timestamp}ms`);
        }

        // Mark the key as held down for the corresponding note type
        keyHeldDown[noteType] = true;

        // Highlight the corresponding stationary note
        highlightedNotes[noteType] = true;

        // Check for note hit (ignore fake notes)
        for (let i = 0; i < notesArray.length; i++) {
            if (notesArray[i].type === noteType && !notesArray[i].type.startsWith("rec")) {
                // Skip fake notes
                const noteY = notesArray[i].y;

                if (noteY >= targetYPositionStart && noteY <= targetYPositionEnd) {
                    // If within the new hit range (550-600)
                    let hitType;
                    const distanceFromCenter = Math.abs(noteY - (targetYPositionStart + targetYPositionEnd) / 2);

                    if (distanceFromCenter <= perfectRange) {
                        hitType = "Perfect"; // Within perfect range
                        points += 1; // Reward for perfect hit
                    } else {
                        hitType = noteY < (targetYPositionStart + targetYPositionEnd) / 2 ? "Early" : "Late";
                        points += 0.5; // Normal points for early or late hits
                    }

                    streak++;
                    if (streak > maxStreak) {
                        maxStreak = streak;
                    }

                    console.log(`${hitType} hit on note: ${noteType}`);

                    playSoundEffect("Resources/SFX/hoverBtn.mp3", 0.3);

                    // Remove note after it's hit
                    notesArray.splice(i, 1);
                    break;
                }
            }
        }
    }
});

// Handle key release events (no changes needed here)
document.addEventListener("keyup", (event) => {
    const noteType = keyBindings[event.key.toUpperCase()];
    if (noteType) {
        // Stop highlighting the stationary note
        highlightedNotes[noteType] = false;

        // Mark the key as no longer held down
        keyHeldDown[noteType] = false;
    }
});

// Function to play a sound
function playSoundEffect(audioPath, vol) {
    const audio = new Audio(audioPath);
    audio.volume = vol;
    audio.play().catch((error) => {
        console.error("Audio playback failed:", error);
    });
}

let lastTime = 0; // To track the time of the last frame

// Update notes positions
function updateNotes(deltaTime) {
    const adjustedNoteSpeed = noteSpeed * (deltaTime / 6); // Adjust note speed based on deltaTime

    for (let i = 0; i < notesArray.length; i++) {
        notesArray[i].y += adjustedNoteSpeed;

        // Check if the note is off the screen
        if (notesArray[i].y > canvas.height) {
            // Ignore fake notes with the "rec" prefix
            if (!notesArray[i].type.startsWith("rec")) {
                notesArray.splice(i, 1);
                points--; // Decrease points for missed note
                streak = 0;
                i--;
            } else {
                // Just remove fake notes, no scoring penalty
                notesArray.splice(i, 1);
                i--;
            }
        }
    }

    // Auto-hit logic
    if (autoHitEnabled) {
        notesArray.forEach((note) => {
            if (Math.abs(note.y - 600) < hitRange) {
                // Ensure that auto-hit aligns with the new Y position
                // Simulate key press
                simulateKeyPress(note.type);
            }
        });
    }
}

// Simulate key press for a note type
function simulateKeyPress(noteType) {
    const key = Object.keys(keyBindings).find((k) => keyBindings[k] === noteType);
    if (key) {
        // Trigger key down event
        document.dispatchEvent(new KeyboardEvent("keydown", { key: key }));
    }

    setTimeout(() => {
        document.dispatchEvent(new KeyboardEvent("keyup", { key: key }));
    }, 75);
}

// Start the game
function startGame() {
    gameStarted = true; // Set the game state to started
    console.log("Game started.");
    audio.play(); // Start playing the audio
    startTime = Date.now(); // Set start time for recording
    generateNotes(); // Start generating notes
    lastTime = performance.now(); // Initialize lastTime with current time
    gameLoop(lastTime); // Start the game loop with the current time
}

// Game loop
function gameLoop(currentTime) {
    const deltaTime = currentTime - lastTime; // Calculate delta time
    lastTime = currentTime; // Update lastTime to currentTime

    if (gameStarted) {
        updateNotes(deltaTime); // Pass deltaTime to updateNotes
        drawNotes();
        requestAnimationFrame(gameLoop); // Request the next frame
    }
}
