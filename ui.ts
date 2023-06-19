import * as editor from "./editor"

let movie = new editor.Movie()
movie.sliderElement = document.getElementById("time-slider") as HTMLInputElement

let addLayerBtn = document.getElementById("add-layer")
let layerContainer = document.getElementById("layer-container")


function getUserInput(msg: string, type: string, verifyFunc: (input: string)=>[string, boolean]) {
    let modal = document.createElement("div")
    modal.classList.add("modal")
    let messageContainer = document.createElement("div")
    messageContainer.classList.add("msg-container")
    let message = document.createElement("h1")
    message.classList.add("msg")
    message.innerHTML = msg
    let input = document.createElement("input")
    input.classList.add("user-input")
    input.setAttribute("type", type)
    let submit = document.createElement("button")
    submit.innerHTML = "ok"
    let [reason, isCorrect] = verifyFunc(input.value)
    if (!isCorrect) {
        submit.disabled = true
    }
    input.addEventListener("change", function(e) {
        let [reason, isCorrect] = verifyFunc(input.value)
        if (isCorrect) {
            submit.disabled = false
        } else {
            submit.disabled = true
        }
    })
    messageContainer.appendChild(message)
    messageContainer.appendChild(input)
    messageContainer.appendChild(submit)
    modal.appendChild(messageContainer)
    document.body.appendChild(modal)
    return new Promise<string>((r: (r: any)=>void, reject: (r: any)=>void)=>{
        submit.addEventListener("click", function(e) {
            r(input.value)
            modal.remove()
        })
    })
}

function createLayerDomNode(l: editor.Layer) {
    let newNode = document.createElement("div")
    newNode.classList.add("layer")
    let addClipBtn = document.createElement("button")
    addClipBtn.innerHTML = "+"
    addClipBtn.addEventListener("click", async function(e: Event) {
        let src = await getUserInput("clip source url", "url", (input: string)=>{
            return ["", true]
        })
        let clip = await new editor.Clip(src).init()
        console.log(src, clip.videoElement)

        l.addClip(clip)
    })
    newNode.appendChild(addClipBtn)
    return newNode
}   

addLayerBtn.addEventListener("click", async function(e) {
    let layer = new editor.Layer([], "multiply" , 1)
    await movie.addLayers([layer.init()])
    let newNode = createLayerDomNode(layer)
    layer.domNode = newNode

    layerContainer.appendChild(layer.domNode)
})

document.getElementById("play").addEventListener("click", function(e) {
    movie.play(0, false)
})