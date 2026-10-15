const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });
const ascii = document.getElementById("ascii");
const stage = document.getElementById("stage");
const resolution = document.getElementById("resolution");
const resolutionValue = document.getElementById("resolutionValue");
const pauseButton = document.getElementById("pause");
const videoFile = document.getElementById("videoFile");
const statusText = document.getElementById("status");
const chars = " .,:;+*?%S#@";
const useVideoFrames = typeof video.requestVideoFrameCallback === "function";
let width = 100;
let height = 50;
let cells = [];
let frameId = null;
let objectUrl = null;
let renderFailed = false;
let sourceVersion = 0;

function fitToScreen() {
    const displayWidth = Math.min(stage.clientWidth, stage.clientHeight * 4 / 3);
    const displayHeight = displayWidth * 3 / 4;
    ctx.font = 'bold 8px "Courier New", monospace';
    const naturalWidth = width * ctx.measureText("M").width;
    const naturalHeight = height * 8;
    ascii.style.width = `${naturalWidth}px`;
    ascii.style.height = `${naturalHeight}px`;
    ascii.style.transform = `translate(-50%, -50%) scale(${displayWidth / naturalWidth}, ${displayHeight / naturalHeight})`;
}

function updateResolution() {
    width = Number(resolution.value);
    height = Math.max(1, Math.floor(width * 3 / 4 * 0.6));
    canvas.width = width;
    canvas.height = height;
    resolutionValue.textContent = width;

    
    const fragment = document.createDocumentFragment();
    cells = [];
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const span = document.createElement("span");
            const text = document.createTextNode(" ");
            span.appendChild(text);
            fragment.appendChild(span);
            cells.push({ span, text, color: -1 });
        }
        fragment.appendChild(document.createTextNode("\n"));
    }
    ascii.replaceChildren(fragment);
    fitToScreen();
    renderFrame();
}

function renderFrame() {
    if (renderFailed || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
    try {
        ctx.drawImage(video, 0, 0, width, height);
        const pixels = ctx.getImageData(0, 0, width, height).data;
        for (let index = 0; index < cells.length; index++) {
            const i = index * 4;
            const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
            const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
            const char = chars[Math.min(chars.length - 1, Math.floor(brightness / 256 * chars.length))];
            const color = (r << 16) | (g << 8) | b;
            const cell = cells[index];
            if (cell.text.nodeValue !== char) cell.text.nodeValue = char;
            if (cell.color !== color) {
                cell.span.style.color = `rgb(${r},${g},${b})`;
                cell.color = color;
            }
        }
    } catch (error) {
        renderFailed = true;
        video.pause();
        stopRendering();
        pauseButton.disabled = true;
        statusText.textContent = error.name === "SecurityError"
            ? "영상 픽셀을 읽을 수 없습니다. ‘영상 선택’에서 파일을 다시 선택해 주세요."
            : "ASCII 변환에 실패했습니다. 다른 영상을 선택해 주세요.";
        console.error(error);
    }
}

function render() {
    frameId = null;
    renderFrame();
    if (!video.paused && !video.ended && !renderFailed) {
        frameId = useVideoFrames
            ? video.requestVideoFrameCallback(render)
            : requestAnimationFrame(render);
    }
}

function stopRendering() {
    if (frameId === null) return;
    if (useVideoFrames) video.cancelVideoFrameCallback(frameId);
    else cancelAnimationFrame(frameId);
    frameId = null;
}

async function startPlayback() {
    const version = sourceVersion;
    try {
        await video.play();
    } catch (error) {
        if (version !== sourceVersion || error.name === "AbortError") return;
        if (error.name === "NotAllowedError") {
            pauseButton.disabled = false;
            statusText.textContent = "자동재생이 차단되었습니다. ‘재생’ 버튼을 눌러 주세요.";
        } else if (!video.error) {
            statusText.textContent = "영상을 재생할 수 없습니다. 다른 영상을 선택해 주세요.";
        }
    }
}

function loadVideo(source) {
    sourceVersion++;
    video.pause();
    stopRendering();
    renderFailed = false;
    pauseButton.disabled = true;
    pauseButton.textContent = "재생";
    statusText.textContent = "영상을 불러오는 중입니다…";
    video.src = source;
    video.load();
    updateResolution();
    startPlayback();
}

videoFile.addEventListener("change", () => {
    const file = videoFile.files[0];
    if (!file) return;
    const previousUrl = objectUrl;
    objectUrl = URL.createObjectURL(file);
    loadVideo(objectUrl);
    if (previousUrl) URL.revokeObjectURL(previousUrl);
});

video.addEventListener("loadedmetadata", updateResolution);
video.addEventListener("loadeddata", () => {
    renderFrame();
    if (!renderFailed) pauseButton.disabled = false;
});
video.addEventListener("playing", () => {
    if (renderFailed) return;
    pauseButton.disabled = false;
    pauseButton.textContent = "일시정지";
    statusText.textContent = "";
    stopRendering();
    render();
});
video.addEventListener("pause", () => {
    stopRendering();
    pauseButton.textContent = "재생";
});
video.addEventListener("seeked", renderFrame);
video.addEventListener("error", () => {
    stopRendering();
    pauseButton.disabled = true;
    pauseButton.textContent = "재생";
    statusText.textContent = "영상을 불러올 수 없습니다. ‘영상 선택’에서 video.mp4를 선택해 주세요.";
});
resolution.addEventListener("input", updateResolution);
pauseButton.addEventListener("click", () => {
    if (video.paused) startPlayback();
    else video.pause();
});

updateResolution();
new ResizeObserver(fitToScreen).observe(stage);
if (location.protocol === "file:") {
    statusText.textContent = "위의 ‘파일 선택’을 눌러 같은 폴더의 video.mp4를 선택해 주세요.";
} else {
    loadVideo("video.mp4");
}
