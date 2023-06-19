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

class Clip {
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
        })
        
    }
    constructor(videoSrc: string) {
        this.videoElement = document.createElement("video")
        this.videoSrc = videoSrc
        
    }
}

class Layer {
    clips: Clip[]
    clipPromises: Promise<Clip>[]
    blendMode: GlobalCompositeOperation
    currentPlayingClip: Clip
    alpha: number
    finished: boolean
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

            if (time >= d) {
                d-=i.videoElement.duration
                clip = i
            } else {
                d-=i.videoElement.duration
                break
            }
 
        }
        // clip is the clip that the time falls into
        // d = the time before the clip begins
        console.log(time, d)
        let timeInClip = time - d
        return [clip, timeInClip]

    }
}

var layers: Layer[] = []




function getDuration(layers: Layer[]): [number, Layer] {
    let longest: Layer = layers[0]
    let length = longest.duration()
    for (let i of layers) {
        let d = i.duration()
        // console.log(d)
        if (d > length) {
            longest = i
            length = d
        }
    }
    return [length, longest]
}




class Movie {
    layers: Layer[]
    paused: boolean
    time: number
    sliderElement: HTMLInputElement
    async addLayers(l: Promise<Layer>[]) {
        this.layers.push(...await Promise.all(l))
        console.log(this.layers)
    }
    setTime(time: number) {
        this.time = time
        // why is nnot resetting thw time
        for (let i of this.layers) {
            var [c,t ] = i.getClipAtTime(time)
            i.currentPlayingClip = c
            i.finished = false
        }
        
    }
    pause() {
        this.paused = true
    }

    updateUI() {
        this.sliderElement.setAttribute("type", "range")
        this.sliderElement.setAttribute("min", "0")
        this.sliderElement.setAttribute("max", getDuration(this.layers).toString())
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
        // var lengthInFrames = length/60
        
        return new Promise<number>((resolve: (reason: any)=>void, reject: (reason:any)=>void) => {
            for (let layer of this.layers) {
                var [clip, t] = layer.getClipAtTime(time)
                // console.log(clip, t, "adwdawd")
                layer.currentPlayingClip = clip
                clip.videoElement.currentTime = t
        
            }
            var currentTime = time;
            // var totalTime = 0;
            let longestLayer = getDuration(this.layers)[1]
            var [c, t] = longestLayer.getClipAtTime(time)
            var clipsTime = time-t; // this is the time of all clips before the one currentyl playing
            this.time = time // this is the actual time wiht current playing video time added on
            // get duration of all clips before c
            // console.log("time: ", this.time)
            
            // the problem is that time is a global value that chnages even when not running we need to increment time by chnage

            var drawVideo = (time: number)=>{
            console.log("time: ", this.time, clipsTime)

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
                            resolve("done")
                            return
                        }
                        continue
                    } else if (i.currentPlayingClip.videoElement.ended) {
                        if (layerIndex == 0) {
                            clipsTime+=i.currentPlayingClip.duration()
                        }
                        let newClipIndex = i.clips.indexOf(i.currentPlayingClip)+1
                        if (newClipIndex > i.clips.length-1) {
                            // layer finished
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
                }
            }
            if (!this.paused) {
                requestAnimationFrame(drawVideo)
            }
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



async function createMovie() {
    let slider = document.getElementById("time-slider") as HTMLInputElement
    let movie = new Movie()
    movie.sliderElement = slider
    await movie.addLayers([
        new Layer([
            new Clip("http://techslides.com/demos/sample-videos/small.mp4").init(),
            
        ], "copy", 1).init(),
        new Layer([
            new Clip("https://file-examples.com/storage/fefb234bc0648a3e7a1a47d/2017/04/file_example_MP4_480_1_5MG.mp4").init()
        ], "multiply", 0.98).init()
    ])
    movie.updateUI()
    slider.addEventListener("change", (e:Event)=>{
        // this.time = parseFloat(slider.value)
        this.time = 0
        movie.play(parseFloat(slider.value), false)
        console.log(this.time, "time after slider")
    })
    document.getElementById("play").addEventListener("click", function(e) {
        if (movie.paused) {
            movie.paused = false
            console.log(movie.paused, movie.time)
            movie.play(movie.time, false)
        } else {
            movie.paused = true
        }
        
    })
}

createMovie()





// function update(){
//     console.log("drawing image")
//   ctx.drawImage(video,0,0,256,256);   
//   requestAnimationFrame(update); // wait for the browser to be ready to present another animation fram.       
// }

