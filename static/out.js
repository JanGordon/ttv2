(() => {
  // editor.ts
  var view = document.getElementById("viewport");
  var ctx = view.getContext("2d");
  var video = document.createElement("video");
  var Clip = class {
    play() {
      this.videoElement.play();
    }
    duration() {
      return this.videoElement.duration;
    }
    init() {
      return new Promise((resolve, reject) => {
        this.videoElement.src = this.videoSrc;
        this.videoElement.addEventListener("loadeddata", (ev) => {
          resolve(this);
        });
        this.videoElement.addEventListener("error", (ev) => {
          reject("src invalid");
        });
      });
    }
    constructor(videoSrc) {
      this.videoElement = document.createElement("video");
      this.videoSrc = videoSrc;
    }
  };
  var Layer = class {
    constructor(clips, blendMode, alpha) {
      this.clipPromises = clips;
      this.alpha = alpha;
      this.blendMode = blendMode;
      this.finished = false;
    }
    init() {
      return new Promise((resolve, reject) => {
        Promise.all(this.clipPromises).then((value) => {
          this.clips = value;
          this.currentPlayingClip = this.clips[0];
          resolve(this);
        });
      });
    }
    addClip(clip) {
      this.clips.push(clip);
      if (this.durationUpdateListener) {
        this.durationUpdateListener();
      }
    }
    duration() {
      let d = 0;
      for (let i of this.clips) {
        d += i.duration();
      }
      return d;
    }
    getClipAtTime(time) {
      let d = 0;
      let clip = this.clips[0];
      for (let i of this.clips) {
        d += i.videoElement.duration;
        console.log(d, time);
        if (time >= d) {
          clip = i;
        } else {
          d -= i.videoElement.duration;
          clip = i;
          break;
        }
      }
      let timeInClip = time - d;
      return [clip, timeInClip];
    }
  };
  function getDuration(layers) {
    let longest = layers[0];
    let length = longest.duration();
    for (let i of layers) {
      let d = i.duration();
      if (d > length) {
        longest = i;
        length = d;
      }
    }
    return [length, longest];
  }
  var Movie = class {
    async addLayers(l) {
      let layers = await Promise.all(l);
      for (let i of layers) {
        this.layers.push(i);
        i.durationUpdateListener = () => {
          this.updateSliderLength();
          this.updateSliderValue();
        };
      }
      this.updateSliderLength();
    }
    updateSliderLength() {
      this.sliderElement.setAttribute("type", "range");
      this.sliderElement.setAttribute("min", "0");
      console.log("setting sldie length", this.layers);
      this.sliderElement.setAttribute("max", getDuration(this.layers)[0].toString());
    }
    setTime(time) {
      this.time = time;
      ctx.globalCompositeOperation = "copy";
      var layerIndex = 0;
      for (let i of this.layers) {
        var [playingClip, t] = i.getClipAtTime(time);
        for (let clipIndex = 0; clipIndex < i.clips.indexOf(playingClip); clipIndex++) {
          i.clips[clipIndex].videoElement.currentTime = i.clips[clipIndex].videoElement.duration;
        }
        playingClip.videoElement.currentTime = t;
        playingClip.videoElement;
        if (layerIndex != 0) {
          ctx.globalCompositeOperation = i.blendMode;
        }
        ctx.globalAlpha = i.alpha;
        i.finished = false;
        if (playingClip.videoElement.currentTime != playingClip.videoElement.duration) {
          ctx.drawImage(playingClip.videoElement, 0, 0, 256, 256);
          i.currentPlayingClip = playingClip;
        } else {
          i.finished = true;
        }
        layerIndex++;
      }
      if (!this.paused) {
        this.paused = true;
        this.callAfterFrameRender = true;
        this.afterFrameRenderCallback = () => setTimeout(() => {
          console.log("playing again at", this.time);
          this.paused = false;
          this.callAfterFrameRender = false;
          this.play(this.time, false);
        }, 1e3 / 60);
      }
      this.updateSliderValue();
    }
    updateSliderValue() {
      this.sliderElement.value = this.time.toString();
    }
    uiTick() {
    }
    pause() {
      this.paused = true;
      for (let i of this.layers) {
        for (let clip of i.clips) {
          clip.videoElement.pause();
        }
      }
    }
    async play(time, pause) {
      this.paused = false;
      for (let i of this.layers) {
        for (let clip of i.clips) {
          clip.videoElement.pause();
        }
      }
      return new Promise((resolve, reject) => {
        for (let layer of this.layers) {
          var [clip, t] = layer.getClipAtTime(time);
          layer.currentPlayingClip = clip;
          clip.videoElement.currentTime = t;
        }
        var currentTime = time;
        let longestLayer = getDuration(this.layers)[1];
        var [c, t] = longestLayer.getClipAtTime(time);
        var clipsTime = time - t;
        this.time = time;
        var lastRoundedTime = Math.round(this.time);
        var drawVideo = (time2) => {
          if (lastRoundedTime != Math.round(this.time) && !this.sliderInUse) {
            this.updateSliderValue();
          }
          this.uiTick();
          lastRoundedTime = Math.round(this.time);
          ctx.globalCompositeOperation = "copy";
          var layerIndex = 0;
          var finished = 0;
          for (let i of this.layers) {
            if (i.finished) {
              finished++;
              if (finished == this.layers.length) {
                console.log("complete");
                this.paused = true;
                resolve("done");
                return;
              }
              continue;
            } else if (i.currentPlayingClip.videoElement.currentTime == i.currentPlayingClip.videoElement.duration) {
              if (layerIndex == 0) {
                clipsTime += i.currentPlayingClip.duration();
              }
              let newClipIndex = i.clips.indexOf(i.currentPlayingClip) + 1;
              if (newClipIndex > i.clips.length - 1) {
                console.log("layer finished");
                i.finished = true;
              } else {
                i.currentPlayingClip = i.clips[newClipIndex];
                i.currentPlayingClip.play();
              }
            } else if (i.currentPlayingClip.videoElement.paused) {
              i.currentPlayingClip.videoElement.play();
            } else if (layerIndex == 0) {
              if (!i.currentPlayingClip.videoElement.paused) {
                this.time = clipsTime + i.currentPlayingClip.videoElement.currentTime;
              }
            }
            if (layerIndex != 0) {
              ctx.globalCompositeOperation = i.blendMode;
            }
            ctx.globalAlpha = i.alpha;
            ctx.drawImage(i.currentPlayingClip.videoElement, 0, 0, 256, 256);
            layerIndex++;
          }
          if (!pause && !this.paused) {
            requestAnimationFrame(drawVideo);
          } else {
            this.paused = true;
            console.log("not playing", pause, this.paused);
          }
          if (this.callAfterFrameRender) {
            if (this.afterFrameRenderCallback) {
              this.afterFrameRenderCallback();
            }
          }
        };
        requestAnimationFrame(drawVideo);
      });
    }
    constructor() {
      this.layers = [];
      this.time = 0;
    }
  };

  // ui.ts
  var movie = new Movie();
  movie.sliderElement = document.getElementById("time-slider");
  var addLayerBtn = document.getElementById("add-layer");
  var layerContainer = document.getElementById("layer-container");
  function getUserInput(msg, type, verifyFunc) {
    let modal = document.createElement("div");
    modal.classList.add("modal");
    let messageContainer = document.createElement("div");
    messageContainer.classList.add("msg-container");
    let message = document.createElement("h1");
    message.classList.add("msg");
    message.innerHTML = msg;
    let input = document.createElement("input");
    input.classList.add("user-input");
    input.setAttribute("type", type);
    let submit = document.createElement("button");
    submit.innerHTML = "ok";
    let [reason, isCorrect] = verifyFunc(input.value);
    if (!isCorrect) {
      submit.disabled = true;
    }
    input.addEventListener("change", function(e) {
      let [reason2, isCorrect2] = verifyFunc(input.value);
      if (isCorrect2) {
        submit.disabled = false;
      } else {
        submit.disabled = true;
      }
    });
    messageContainer.appendChild(message);
    messageContainer.appendChild(input);
    messageContainer.appendChild(submit);
    modal.appendChild(messageContainer);
    document.body.appendChild(modal);
    return new Promise((r, reject) => {
      submit.addEventListener("click", function(e) {
        r(input.value);
        modal.remove();
      });
    });
  }
  function createLayerDomNode(l) {
    let newNode = document.createElement("div");
    newNode.classList.add("layer");
    let addClipBtn = document.createElement("button");
    addClipBtn.innerHTML = "+";
    addClipBtn.addEventListener("click", async function(e) {
      let src = await getUserInput("clip source url", "url", (input) => {
        return ["", true];
      });
      let clip = new Clip(src).init().then((clip2) => {
        console.log(src, clip2.videoElement);
        l.addClip(clip2);
      }).catch((r) => {
        alert(r);
      });
    });
    newNode.appendChild(addClipBtn);
    return newNode;
  }
  addLayerBtn.addEventListener("click", async function(e) {
    let layer = new Layer([], "multiply", 1);
    await movie.addLayers([layer.init()]);
    let newNode = createLayerDomNode(layer);
    layer.domNode = newNode;
    layerContainer.appendChild(layer.domNode);
  });
  document.getElementById("play").addEventListener("click", function(e) {
    if (movie.paused) {
      movie.play(movie.time, false);
    } else {
      movie.pause();
    }
  });
  movie.sliderElement.addEventListener("pointerdown", function(e) {
    movie.sliderInUse = true;
  });
  document.addEventListener("pointerup", function(e) {
    movie.sliderInUse = false;
  });
  movie.sliderElement.addEventListener("change", function(e) {
    console.log("settings time aw dawd awd dw ");
    movie.setTime(parseFloat(movie.sliderElement.value));
  });
})();
