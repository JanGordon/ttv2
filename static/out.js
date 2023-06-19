(() => {
  // main.ts
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
        if (time >= d) {
          d -= i.videoElement.duration;
          clip = i;
        } else {
          d -= i.videoElement.duration;
          break;
        }
      }
      console.log(time, d);
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
      this.layers.push(...await Promise.all(l));
      console.log(this.layers);
    }
    setTime(time) {
      this.time = time;
      for (let i of this.layers) {
        var [c, t] = i.getClipAtTime(time);
        i.currentPlayingClip = c;
        i.finished = false;
      }
    }
    pause() {
      this.paused = true;
    }
    updateUI() {
      this.sliderElement.setAttribute("type", "range");
      this.sliderElement.setAttribute("min", "0");
      this.sliderElement.setAttribute("max", getDuration(this.layers).toString());
    }
    async play(time, pause) {
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
        var drawVideo = (time2) => {
          console.log("time: ", this.time, clipsTime);
          ctx.globalCompositeOperation = "copy";
          var layerIndex = 0;
          var finished = 0;
          for (let i of this.layers) {
            if (i.finished) {
              finished++;
              if (finished == this.layers.length) {
                console.log("complete");
                resolve("done");
                return;
              }
              continue;
            } else if (i.currentPlayingClip.videoElement.ended) {
              if (layerIndex == 0) {
                clipsTime += i.currentPlayingClip.duration();
              }
              let newClipIndex = i.clips.indexOf(i.currentPlayingClip) + 1;
              if (newClipIndex > i.clips.length - 1) {
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
          }
        };
        if (!this.paused) {
          requestAnimationFrame(drawVideo);
        }
      });
    }
    constructor() {
      this.layers = [];
      this.time = 0;
    }
  };
  async function createMovie() {
    let slider = document.getElementById("time-slider");
    let movie = new Movie();
    movie.sliderElement = slider;
    await movie.addLayers([
      new Layer([
        new Clip("http://techslides.com/demos/sample-videos/small.mp4").init()
      ], "copy", 1).init(),
      new Layer([
        new Clip("https://file-examples.com/storage/fefb234bc0648a3e7a1a47d/2017/04/file_example_MP4_480_1_5MG.mp4").init()
      ], "multiply", 0.98).init()
    ]);
    movie.updateUI();
    slider.addEventListener("change", (e) => {
      this.time = 0;
      movie.play(parseFloat(slider.value), false);
      console.log(this.time, "time after slider");
    });
    document.getElementById("play").addEventListener("click", function(e) {
      if (movie.paused) {
        movie.paused = false;
        console.log(movie.paused, movie.time);
        movie.play(movie.time, false);
      } else {
        movie.paused = true;
      }
    });
  }
  createMovie();
})();
