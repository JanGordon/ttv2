let view = document.getElementById("viewport")! as HTMLCanvasElement

let ctx = view.getContext("2d")
var video = document.createElement("video");

// document.addEventListener("click", function(){
//     console.log("drawing image")
//     video.src = "http://techslides.com/demos/sample-videos/small.mp4";

//     video.addEventListener('loadeddata', function() {
//     video.play();  // start playing
//     update(); //Start rendering
// });})

var videoElements: HTMLVideoElement[] = []

export class Clip {
    videoSrc: string
    audioSrc: string
    videoElement: HTMLVideoElement
    play() {
        // this.videoElement.src = this.videoSrc
        // addveentlistenr for lodaed data
        this.videoElement.play()
    }
    duration(): number {
        return this.videoElement.duration
    }
    init(): Promise<Clip> {
        return new Promise<Clip>((resolve: (reason: any)=>void, reject: (reason:any)=>void)=>{
            this.videoElement.src = this.videoSrc
            this.videoElement.addEventListener("loadeddata", (ev: Event)=>{
                resolve(this)
            })
            this.videoElement.addEventListener("error", (ev: Event)=>{
                reject("src invalid")
            })
        })
        
    }
    constructor(videoSrc: string) {
        this.videoElement = document.createElement("video")
        this.videoSrc = videoSrc
        
    }
}

export class Layer {
    clips: Clip[]
    clipPromises: Promise<Clip>[]
    blendMode: GlobalCompositeOperation
    currentPlayingClip: Clip
    alpha: number
    finished: boolean
    domNode: HTMLElement
    durationUpdateListener: ()=>void
    // videoElement: HTMLVideoElement
    constructor(clips: Promise<Clip>[], blendMode: GlobalCompositeOperation, alpha: number) {
        // this.videoElement = document.createElement("video")
        // this.clips = clips
        this.clipPromises = clips
        this.alpha = alpha
        this.blendMode = blendMode
        this.finished = false
    }
    init(): Promise<Layer> {
        // resolves all clip promises
        return new Promise<Layer>((resolve: (reason: any)=>void, reject: (reason:any)=>void)=>{
            Promise.all(this.clipPromises)
                .then((value: Clip[])=>{
                    this.clips = value
                    this.currentPlayingClip = this.clips[0]

                    resolve(this)
                })
        })
    }
    addClip(clip: Clip) {
        // clip.videoElement = this.videoElement
        this.clips.push(clip)
        if (this.durationUpdateListener) {
            this.durationUpdateListener()
        }
    }
    duration(): number {
        let d = 0;
        for (let i of this.clips) {
            d+= i.duration()
        }
        return d
    }
    getClipAtTime(time: number): [Clip, number] {
        let d = 0
        let clip = this.clips[0]
        for (let i of this.clips) {
            d+=i.videoElement.duration
            console.log(d, time)
            if (time >= d) {
                // d-=i.videoElement.duration
                clip = i
            } else {
                d-=i.videoElement.duration
                clip = i
                break
            }
 
        }
        // clip is the clip that the time falls into
        // d = the time before the clip begins
        let timeInClip = time - d
        return [clip, timeInClip]

    }
}

var layers: Layer[] = []




export function getDuration(layers: Layer[]): [number, Layer] {
    let longest: Layer = layers[0]
    let length = longest.duration()
    for (let i of layers) {
        let d = i.duration()
        if (d > length) {
            longest = i
            length = d
        }
    }
    return [length, longest]
}




export class Movie {
    layers: Layer[]
    paused: boolean
    time: number
    sliderElement: HTMLInputElement
    sliderInUse: boolean
    callAfterFrameRender: boolean
    afterFrameRenderCallback: ()=>void
    async addLayers(l: Promise<Layer>[]) {
        let layers = await Promise.all(l)
        for (let i of layers) {
            this.layers.push(i)
            i.durationUpdateListener = ()=>{
                this.updateSliderLength()
                this.updateSliderValue()
            }
        }
        
        this.updateSliderLength()
    }
    updateSliderLength() {
        this.sliderElement.setAttribute("type", "range")
        this.sliderElement.setAttribute("min", "0")
        console.log("setting sldie length", this.layers)
        this.sliderElement.setAttribute("max", getDuration(this.layers)[0].toString())
        
    }
    setTime(time: number) {
        this.time = time
        // why is nnot resetting thw time
        ctx.globalCompositeOperation = 'copy';
        var layerIndex = 0;
        for (let i of this.layers) {
            
            var [playingClip,t ] = i.getClipAtTime(time)
            for (let clipIndex = 0; clipIndex < i.clips.indexOf(playingClip); clipIndex++) {
                i.clips[clipIndex].videoElement.currentTime = i.clips[clipIndex].videoElement.duration
            }
            playingClip.videoElement.currentTime = t
            playingClip.videoElement
            if (layerIndex != 0) {
                ctx.globalCompositeOperation = i.blendMode;

            }
            ctx.globalAlpha = i.alpha
            i.finished = false

            // only draw image of video if it hasnt ended
            if (playingClip.videoElement.currentTime != playingClip.videoElement.duration) {
                ctx.drawImage(playingClip.videoElement, 0, 0, 256, 256)
                i.currentPlayingClip = playingClip
                
            } else {
                i.finished = true
                // console.log("clip is finsihed", playingClip, i.clips.indexOf(playingClip), t, playingClip.videoElement.currentTime, time - t, time)
            }
            //
            layerIndex++
        }

        // if movie is playing, then restart it at time
        if (!this.paused) {
            this.paused = true
            this.callAfterFrameRender = true
            this.afterFrameRenderCallback = ()=>setTimeout(()=>{
                console.log("playing again at", this.time)
                this.paused=false
                this.callAfterFrameRender = false
                this.play(this.time, false)
            }, 1000/60)
            // stops otehr play thread
            
        }
        this.updateSliderValue()
        
    }
   

    updateSliderValue() {
        // console.log("updating slier value")
        this.sliderElement.value = this.time.toString()
    }
    uiTick() {

    }

    pause() {
        this.paused = true
        for (let i of this.layers) {
            for (let clip of i.clips) {
                clip.videoElement.pause()
            }
        }
    }

    async play(time: number, pause: boolean) {
        // get longest layer
        // let longest: Layer = this.layers[0]
        // let length = await longest.duration()
        // for (let i of this.layers) {
        //     let d = await i.duration()
        //     if (d > length) {
        //         longest = i
        //         length = d
        //     }
        // }
        this.paused = false
        // var lengthInFrames = length/60
        for (let i of this.layers) {
            for (let clip of i.clips) {
                clip.videoElement.pause()
            }
        }
        
        return new Promise<number>((resolve: (reason: any)=>void, reject: (reason:any)=>void) => {
            for (let layer of this.layers) {
                var [clip, t] = layer.getClipAtTime(time)
                // console.log(clip, t, "adwdawd")
                layer.currentPlayingClip = clip
                clip.videoElement.currentTime = t
        
            }
            var currentTime = time;
            // console.log("playing video at ", time)
            // var totalTime = 0;
            let longestLayer = getDuration(this.layers)[1]
            var [c, t] = longestLayer.getClipAtTime(time)
            var clipsTime = time-t; // this is the time of all clips before the one currentyl playing
            this.time = time // this is the actual time wiht current playing video time added on
            // get duration of all clips before c
            // console.log("time: ", this.time)
            
            // the problem is that time is a global value that chnages even when not running we need to increment time by chnage
            var lastRoundedTime = Math.round(this.time)

            var drawVideo = (time: number)=>{
            // console.log("time: ", this.time, clipsTime)
                if (lastRoundedTime != Math.round(this.time) && !this.sliderInUse) {
                    this.updateSliderValue()
                }
                this.uiTick()
                lastRoundedTime = Math.round(this.time)
                ctx.globalCompositeOperation = 'copy';
            //     console.log("wad", this.time)
            //     // 
            //     this.time += (time-lastTime)/60
            //     // console.log(time)
            // console.log("daw", this.time, time-lastTime)
                
                var layerIndex = 0
                var finished = 0
                for (let i of this.layers) {
                    if (i.finished) {
                        finished++
                        if (finished == this.layers.length) {
                            // full render complete
                            console.log("complete")
                            this.paused = true
                            resolve("done")
                            return
                        }
                        continue
                    } else if (i.currentPlayingClip.videoElement.currentTime == i.currentPlayingClip.videoElement.duration) {
                        if (layerIndex == 0) {
                            clipsTime+=i.currentPlayingClip.duration()
                        }
                        let newClipIndex = i.clips.indexOf(i.currentPlayingClip)+1
                        if (newClipIndex > i.clips.length-1) {
                            // layer finished
                            console.log("layer finished")
                            i.finished = true
                        } else {
                            i.currentPlayingClip = i.clips[newClipIndex]
                            
                            
                            
                            i.currentPlayingClip.play()
                        }
                        
                        
                    } else if (i.currentPlayingClip.videoElement.paused) {
                        i.currentPlayingClip.videoElement.play()
                    } else if (layerIndex == 0) {
                        if (!i.currentPlayingClip.videoElement.paused) {
                            this.time = clipsTime + i.currentPlayingClip.videoElement.currentTime
                        }
                    }
                    // console.log("drawing", i.currentPlayingClip.videoElement)
                    // ctx.globalCompositeOperation = 'multiply';
                    if (layerIndex != 0) {
                        ctx.globalCompositeOperation = i.blendMode;
        
                    }
                    ctx.globalAlpha = i.alpha
                    ctx.drawImage(i.currentPlayingClip.videoElement, 0, 0, 256, 256)
                    layerIndex++
                }
                // lastTime = time
                
                if (!pause && !this.paused) {
                    requestAnimationFrame(drawVideo)
                    
                } else {
                    this.paused = true
                    console.log("not playing", pause, this.paused)
                }
                if (this.callAfterFrameRender) {
                    if (this.afterFrameRenderCallback) {
                        this.afterFrameRenderCallback()
                    }
                }
            }
            // if (!this.paused) {
                requestAnimationFrame(drawVideo)
            // }
        })
        
        
    }
    constructor() {
        this.layers = []
        this.time = 0
    }
    
}
// Promise.all(l)
//     .then((layers: Layer[])=>{
//         // view.addEventListener("click", async ()=>{
//         //     await play(layers, 3, false)
//         //     console.log("done")
//         // })
        
//         // slider.addEventListener("change", function(e: Event) {
        
//         // })
        
        
//         updateVideo(layers)
//     })

// let slider = document.getElementById("time-slider") as HTMLInputElement
// function updateVideo(l: Layer[], time: number) {
//     slider.setAttribute("type", "range")
//     slider.setAttribute("min", "0")
//     slider.setAttribute("max", getDuration(layers).toString())
//     play(l, parseFloat(slider.value), true)
// }









// function update(){
//     console.log("drawing image")
//   ctx.drawImage(video,0,0,256,256);   
//   requestAnimationFrame(update); // wait for the browser to be ready to present another animation fram.       
// }

