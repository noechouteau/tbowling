import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import * as dat from 'lil-gui'
import * as CANNON from 'cannon-es'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import CannonDebugger from 'cannon-es-debugger'
import { threeToCannon, ShapeType } from 'three-to-cannon';
import { gsap } from "gsap";

let twoPlayers = false
let playerTurn = 1
let finished = false

THREE.ColorManagement.enabled = false
let followBall = false
let ballLaunched = false
let totalScore = 0
let totalScore2 = 0
let manche = 1
let tir = 1
let Lastnb = 0

let highscore = window.localStorage.getItem("highscore")
let highscoreName = window.localStorage.getItem("highscoreName")

let menuDiv = document.getElementById("menuDiv")
let titleDiv = document.getElementById("titleDiv")
let oplayer = document.getElementById("oplayer")
let tplayers = document.getElementById("tplayers")
let hishgscoreH1 = document.getElementById("highscoreH1")


let eventImageDiv = document.getElementById("eventImageDiv")
let eventImage = document.getElementById("eventImage")
let eventText = document.getElementById("eventText")
let strikeText = document.getElementById("strikeText")
let spareText = document.getElementById("spareText")
let strikeText2 = document.getElementById("strikeText2")
let spareText2 = document.getElementById("spareText2")
let finishedText = document.getElementById("finishedText")
let restartButton = document.getElementById("restartButton")

let failSounds = ["alarm.mp3", "boom.mp3", "goofyglisse.mp3","malicieux.mp3","vi.mp3", "baby.mp3"]
let failImages = ["wwchokbar.jpg","moai.jpg","nerd.jpg","wisetree.jpg","grr.jpg","ahah.png"]

let scoreDiv = document.getElementById("scoreDiv")
let scoreDiv2 = document.getElementById("scoreDiv2")

const loadingBarContainer = document.querySelector('.loading-bar')
const loadingBarElement = document.querySelector('.progress')
const waitText = document.querySelector('#waitText')
const launchText = document.querySelector('#launchText')

const loadingManager = new THREE.LoadingManager(
    () =>
    {
        // console.log('loaded')
        waitText.classList.add('ended')
        waitText.style.display = 'none'
        launchText.classList.remove('ended')
        gsap.delayedCall(1., () =>
        {
            gsap.to(overlayMaterial.uniforms.uAlpha, { duration: 3, value: 0.4, delay: 0.3 })
            gsap.to(titleDiv, { duration: 0.5, top: 0, ease:"back.out"})
            gsap.to(oplayer.parentElement, { duration: 1, left: 0, ease:"back.out",delay: 1.3})
            gsap.to(tplayers.parentElement, { duration: 1, right: 0, ease:"back.out",delay: 1.3})
            loadingBarContainer.style.opacity = '0'
            gsap.delayedCall(1, () =>
            {
                loadingBarContainer.style.display = 'none'
                launchText.style.opacity = '0'
            })
  
        })
    },
    ( itemsUrl, itemsLoaded, itemsTotal) =>
    {
        // console.log(itemsLoaded, itemsTotal)
        const progressRatio = itemsLoaded / itemsTotal
        // console.log(progressRatio)
        loadingBarElement.style.transform = `scaleX(${progressRatio})`
    }
  )



/**
 * Debug
 */
const debugObject = {}

debugObject.reset = () =>
{
    for(const object of objectsToUpdate)
    {
        object.body.removeEventListener('collide', playHitSound)
        world.remove(object.body)

        scene.remove(object.mesh)
    }
    objectsToUpdate.splice(0, objectsToUpdate.length)
}

/**
 * Base
 */
// Canvas
const canvas = document.querySelector('canvas.webgl')

// Scene
const scene = new THREE.Scene()

const overlayGeometry = new THREE.PlaneGeometry(2, 2, 1, 1)
const overlayMaterial = new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    uniforms: {
        uAlpha: { value: 1 }
    },
    vertexShader: `
        void main()
        {
            gl_Position =  vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform float uAlpha;

        void main()
        {
            gl_FragColor = vec4(0.0, 0.0, 0.0, uAlpha);
        }
    `,
})
const overlay = new THREE.Mesh(overlayGeometry, overlayMaterial)
overlay.position.set(-5, 0, 0)
scene.add(overlay)

//Sound
const hitSound = new Audio('/sounds/hit.wav')
const wallSound = new Audio('/sounds/hit.mp3')
const bg = new Audio('/sounds/bg.mp3')

bg.volume = 0.4
bg.loop = true

let already = false
const playHitSound = (collision) =>
{
    console.log(collision.body.id)
    const impactStrength = collision.contact.getImpactVelocityAlongNormal()

    if(impactStrength > 1.5 && collision.body.id != 0 && !already && collision.body.id != 1 && collision.body.id != 2 && collision.body.id != 3 && collision.body.id != 4)
    {
        already = true
        hitSound.volume = 0.3
        hitSound.currentTime = 0
        hitSound.play()
    } else if(collision.body.id == 0 || collision.body.id == 1 || collision.body.id == 2 || collision.body.id == 3 || collision.body.id == 4){
        wallSound.volume = 0.5
        wallSound.currentTime = 0
        wallSound.play()
    }

}

/**
 * Textures
 */
const textureLoader = new THREE.TextureLoader()
const cubeTextureLoader = new THREE.CubeTextureLoader()

const environmentMapTexture = cubeTextureLoader.load([
    '/textures/environmentMaps/0/px.png',
    '/textures/environmentMaps/0/nx.png',
    '/textures/environmentMaps/0/py.png',
    '/textures/environmentMaps/0/ny.png',
    '/textures/environmentMaps/0/pz.png',
    '/textures/environmentMaps/0/nz.png'
])

/**
 * Models
 */
const gltfLoader = new GLTFLoader(loadingManager)


/**
 * Physics
 */
// World
const world = new CANNON.World()
world.broadphase = new CANNON.SAPBroadphase(world)
world.allowSleep = true
world.gravity.set(0, - 9.82, 0)

//Materials
const defaultMaterial = new CANNON.Material('default')

const defaultContactMaterial = new CANNON.ContactMaterial
(
    defaultMaterial,
    defaultMaterial,
    {
        friction: 1,
        restitution: 0.5
    }
)

const ballContactMaterial = new CANNON.ContactMaterial
(
    defaultMaterial,
    defaultMaterial,
    {
        friction: 1.,
        restitution: 0.
    }
)

world.addContactMaterial(defaultContactMaterial)
world.addContactMaterial(ballContactMaterial)
world.defaultContactMaterial = defaultContactMaterial



// Floor
const floorShape = new CANNON.Box(new CANNON.Vec3(40, 2, 0.1))
const floorBody = new CANNON.Body()
floorBody.addShape(floorShape)
floorBody.quaternion.setFromAxisAngle(
    new CANNON.Vec3(- 1, 0, 0),
    Math.PI * 0.5
)

floorBody.position.x = 38
floorBody.position.z = - 0.35
world.addBody(floorBody)


// Quille hole
const wallShape = new CANNON.Box(new CANNON.Vec3(0.1, 2, 2))
const leftWallBody = new CANNON.Body()
leftWallBody.addShape(wallShape)
leftWallBody.quaternion.setFromAxisAngle(
    new CANNON.Vec3(0, 1, 0),
    Math.PI * 0.5
)

leftWallBody.position.x = 78
leftWallBody.position.z = - 2.47

const rightWallBody = new CANNON.Body()
rightWallBody.addShape(wallShape)
rightWallBody.quaternion.setFromAxisAngle(
    new CANNON.Vec3(0, 1, 0),
    Math.PI * 0.5
)

rightWallBody.position.x = 78
rightWallBody.position.z = 1.74

const backWallBody = new CANNON.Body()
backWallBody.addShape(wallShape)
backWallBody.quaternion.setFromAxisAngle(
    new CANNON.Vec3(1, 0, 0),
    Math.PI * 0.5
)

backWallBody.position.x = 80
backWallBody.position.z = - 0.35

const topWallBody = new CANNON.Body()
topWallBody.addShape(wallShape)
topWallBody.quaternion.setFromAxisAngle(
    new CANNON.Vec3(0, 0, 1),
    Math.PI * 0.5
)

topWallBody.position.x = 78
topWallBody.position.z = - 0.35
topWallBody.position.y = 2
world.addBody(leftWallBody)
world.addBody(rightWallBody)
world.addBody(backWallBody)
world.addBody(topWallBody)


/**
 * Lights
 */
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7)
scene.add(ambientLight)

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.2)
directionalLight.castShadow = true
directionalLight.shadow.mapSize.set(1024, 1024)
directionalLight.shadow.camera.far = 15
directionalLight.shadow.camera.left = - 7
directionalLight.shadow.camera.top = 7
directionalLight.shadow.camera.right = 7
directionalLight.shadow.camera.bottom = - 7
directionalLight.position.set(5, 5, 5)
scene.add(directionalLight)

/**
 * Sizes
 */
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
}

window.addEventListener('resize', () =>
{
    // Update sizes
    sizes.width = window.innerWidth
    sizes.height = window.innerHeight

    // Update camera
    camera.aspect = sizes.width / sizes.height
    camera.updateProjectionMatrix()

    // Update renderer
    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})

/**
 * Camera
 */
// Base camera
const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 100)
// camera.position.set(75, 3, -0.3)
// camera.position.set(-4, 2, -0.3)
camera.position.set(0, 7, -0.3)

scene.add(camera)

// Controls
const controls = new OrbitControls(camera, canvas)
controls.enableDamping = false
controls.enablePan = false
controls.enableRotate = false
controls.enableZoom = false

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
})
renderer.outputColorSpace = THREE.LinearSRGBColorSpace
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

/**
 * Utils
 */
const objectsToUpdate = []



const cannonDebugger = new CannonDebugger(scene, world, {
    // options...
  })


let ballBody
let ballMesh
const createBall = (radius,position) =>
{
    let model
    if(playerTurn == 1 ){
        model = '/models/blueBowlingBall.glb'
    } else {
        model = '/models/redBowlingBall.glb'
    }
    gltfLoader.load(
        model,
        (gltf) =>
        {
            console.log()
            //THree js mesh
            const mesh = gltf.scene
            mesh.scale.set(radius/1.05,radius/1.05,radius/1.05)
            mesh.castShadow = true
            ballMesh = mesh
            mesh.position.copy(position)
            
            scene.add(mesh)
        
            //Cannon js body
            const shape = new CANNON.Sphere(radius)
            const body = new CANNON.Body({
                mass: 4,
                position: new CANNON.Vec3(0,3,0),
                shape,
                material: ballContactMaterial
            })
            body.velocity.y = 0
            ballBody = body  
            body.position.copy(position)
            body.addEventListener('collide', playHitSound)


            // body.applyLocalForce(new CANNON.Vec3(9000,0,0), new CANNON.Vec3(0,0,0))
            world.addBody(body)
        
            //Save in objects to update
            objectsToUpdate.push({
                mesh,
                body
            })
        }
    )
}

//8000 - 1000 et 13000 - 6000
let quilles = []
let qMeshes = []
const createQuille = (size,radiusTop, radiusBottom,height, position, numSegments) =>
{
    gltfLoader.load(
        '/models/quille.glb',
        (gltf) =>
        {
            console.log()
            //THree js mesh
            const mesh = gltf.scene
            mesh.scale.set(size,size,size)
            mesh.castShadow = true
            qMeshes.push(mesh)
            scene.add(mesh)
            const result = threeToCannon(mesh, {type: ShapeType.CYLINDER});
        
            console.log(result)
            //Cannon js body
            //new CANNON.Cylinder(radiusTop, radiusBottom, height, numSegments)
            //threeToCannon(mesh, {type: ShapeType.MESH}).shape
            //(shape, new CANNON.Vec3(0,0,0), new CANNON.Quaternion(-0.7071,0,0,0.7071))
            const shape = new CANNON.Cylinder(radiusTop, radiusBottom, height, numSegments)
            const body = new CANNON.Body({
                mass: 1,
                shape,
                material: defaultMaterial
            })
            body.position.copy(position)
            quilles.push(body)
            console.log(quilles)
            world.addBody(body)
        
            //Save in objects to update
            objectsToUpdate.push({
                mesh,
                body
            })
        }
    )

}

createBall(0.47,{x:-1,y:0.9,z:-0.3})

let createQuilles = () => {
    let row = 76
    let cpt = 0
    let nbP = 0.55

    let col = 0

    for(let i = 0; i<10; i++)
    {
        if(nbP == 0.55){
            col = -0.55
        }
        createQuille(0.3,0.12,0.12,1.2,{x:row,y:0.67777777,z:col+0.2},20)

        cpt +=0.55
        col+= 1.1
        if(cpt == nbP){
            cpt = 0
            col = 0
            nbP +=0.55
            row += 0.55

            col -= nbP
        }
    }
}

createQuilles()

const boxShape = new CANNON.Box(new CANNON.Vec3(2, 2, 5))
const lightShape = new CANNON.Box(new CANNON.Vec3(2, 0.5, 2))
const quilleTrigger = new CANNON.Body({ isTrigger: true })


let arrowMesh 
gltfLoader.load(
    '/models/arrow.glb',
    (gltf) =>
    {
        arrowMesh = gltf.scene
        arrowMesh.rotation.set(0,-Math.PI/2,0)
        arrowMesh.position.set(1, 0.2, -0.3)
    }
)


const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();


quilleTrigger.addShape(lightShape)
quilleTrigger.position.set(77, 1.5, 0)


let bodyList = []
quilleTrigger.addEventListener('collide', (event) => {
    if(!bodyList.includes(event.body)){
        bodyList.push(event.body)
        console.log(event.body)
    }
    console.log(bodyList.length)
})

gltfLoader.load(
    '/models/bowlRoom.glb',
    (gltf) =>
    {
        gltf.scene.position.set(60,0,-75.6)
        gltf.scene.scale.set(4.,4.,4.)
        gltf.scene.rotation.set(0,Math.PI,0)
        scene.add(gltf.scene)
    }
)

/**
 * Animate
 */
const clock = new THREE.Clock()
let oldElapsedTime = 0
// controls.target.set(80, 0, -0.5)
// controls.target.set(0, 0, -0.3)
controls.target.set(-20, 0, 13)


let handleFailure = () => {
    Lastnb++
    if(Lastnb == 6){
        Lastnb = 0
    }
    let sound = failSounds[Lastnb]

    eventImage.src = "/images/"+failImages[Lastnb]
    eventImage.style.opacity = 1
    eventText.style.opacity = 1
    let audio = new Audio("/sounds/bruh/"+sound)
    audio.volume = 0.1
    audio.play()

    gsap.to(eventImage, {
        
        duration: 4,
        opacity: 0,
    });

    gsap.to(eventText, {

        duration: 4,
        opacity: 0,
    });
}

let annId = 1
let announces = ["0.mp3", "1.mp3", "2.mp3", "3.mp3", "4.mp3", "5.mp3"]

let handleStrikeSpare = (text) => {
    text.style.display = "grid"
    text.style.opacity = 1
    let announcer = new Audio("/sounds/announcer/"+announces[annId])
    let success = new Audio("/sounds/success.mp3")
    let audio
    if(text.contains(strikeText)){
        audio = new Audio("/sounds/strike.mp3")
    } else {
        audio = new Audio("/sounds/spare.mp3")
    }
    audio.volume = 0.2
    success.volume = 0.3
    announcer.volume = 1
    announcer.play()
    success.play()
    audio.play()
    annId++
    if(annId == 6){
        annId = 1
    }

    gsap.set(text, {
        scale: 0.1,
    })

    gsap.to(text, {

        duration: 1,
        ease: "bounce.out",
        scale: 1,
    }).then(() => {
        gsap.delayedCall(1, () => {
            gsap.to(text, {
                duration: 0.4,
                ease: "ease.out",
                top: "-70vh",
            }).then(()=>{
                text.style.top = ""
                text.style.opacity = 0
                text.style.scale = 1
            })
        })
    })
    }

let time = 0
let setTime = 0

const tick = () =>
{
    const elapsedTime = clock.getElapsedTime()
    const deltaTime = elapsedTime - oldElapsedTime
    oldElapsedTime = elapsedTime

    if(ballBody && ballBody.position.x > 65 && ballLaunched){
        if(setTime == 0){
            setTime = elapsedTime
        }
        time = elapsedTime - setTime
        console.log(time)
    }

    if(ballBody && followBall && camera.position.x < 70 && ballBody.position.y > 0){
        
        gsap.to(camera.position, { 
            duration: 0.5,
            ease: "power1.in.out",
            x: ballBody.position.x - 5,
            y: ballBody.position.y + 1,
          });
          gsap.to(controls.target, { 
            duration: 0.5,
            ease: "power1.in.out",
            x: ballBody.position.x,
            y: ballBody.position.y,
            z: ballBody.position.z,
          });
    } else if((ballBody && ballBody.position.x > 79 && ballLaunched) ||(ballBody && ballBody.position.y < 0 && ballLaunched) || time > 5){
        let cpt = 0
        time = 0
        setTime = 0
        ballLaunched = false
        console.log("test")
        let i = 0

        if(ballBody.position.y < 0 && ballBody.position.x < 73){
            handleFailure()
        }

        ballBody.velocity.set(0,0,0)
        setTimeout(() => {
            for(let quille of quilles){
                console.log(quille.id, quille.position.x + quille.position.z, quille.position.y)
                if(quille.position.y < 0.6 && tempQuilles.length == 0){
                    cpt++
                    world.removeBody(quille)
                    scene.remove(qMeshes[i])

                    console.log(quille.id == 16)
                }
                else if(tempQuilles && quille.position.y < 0.6 && tempQuilles.includes(quille)){
                    cpt++
                    world.removeBody(quille)
                    scene.remove(qMeshes[i])
                } else {
                    upQuilles.push(quille)
                }
                i++
                if(quille == quilles[quilles.length-1]){
                    console.log(cpt)
                    if(playerTurn == 1){
                        handleTir(cpt)
                    } else {
                        handleTir2(cpt)
                    }
                }

            }
            console.log(quilles)
            gsap.to(camera.position, { 
                duration: 1,
                ease: "power1.in.out",
                x: -4,
                y: 2,
              });
            gsap.to(controls.target, { 
                duration: 1,
                ease: "power1.in.out",
                x: 0,
                y: 0,
                z: -0.3,
              });
            followBall = false
            world.removeBody(ballBody)
            scene.remove(ballMesh)
            createBall(0.47,{x:-1,y:0.9,z:-0.3})
    
        }, 3000);
    }

    raycaster.setFromCamera( pointer, camera );

    // Update physics world
    world.step(1 / 60, deltaTime, 3)

    for(const object of objectsToUpdate)
    {
        object.mesh.position.copy(object.body.position)
        object.mesh.quaternion.copy(object.body.quaternion)
    }

    // Update controls
    controls.update()
    // cannonDebugger.update() 
    // Render
    renderer.render(scene, camera)

    // Call tick again on the next frame
    window.requestAnimationFrame(tick)
}

tick()


let clickTimer;
let secondTimer;


function getPointer(event) {
    ballLaunched = true
    positionPointer(event)

  }

window.addEventListener('mousedown', function(event) {
    console.log('mousedown')
    positionPointer(event)

    if(event.target == oplayer){
        handleOnePlayerClick()
    } else if(event.target == tplayers){
        handleTwoPlayersClick()
    }

    const intersects = raycaster.intersectObjects( scene.children );

	for (let intersect of intersects) {

        console.log(intersect.object)
        if(intersect.object.name.includes("Bowling_ball")){
            scene.add(arrowMesh)
            window.addEventListener('pointermove', getPointer, false);

        }
	}
});
  

window.addEventListener('mouseup', function(event) {
    positionPointer(event)
    console.log(pointer)
    scene.remove(arrowMesh)


    if(ballLaunched && followBall == false){
        if(pointer.y == 0){
            pointer.x = 0.5
        }
        gsap.to(scoreDiv, { 
            duration: 0.7,
            ease: "back.in",
            left: "-1000px",
          });
        gsap.to(scoreDiv2, {
            duration: 0.7,
            ease: "back.in",
            right: "-1000px",
            });
        followBall = true
        ballBody.applyLocalForce(new CANNON.Vec3(pointer.y*-10000,0,pointer.x * -2500), new CANNON.Vec3(0,0,0))
        let bodyList = []


    }


    window.removeEventListener('pointermove', getPointer, false);
});

window.addEventListener('mousemove', function(event) {
    positionPointer(event)
})

let positionPointer = (event) => {
    pointer.x = (event.clientX / sizes.width) * 2 - 1
    pointer.y = - (event.clientY / sizes.height) * 2 + 1

    if(pointer.y < -1) {
        pointer.y = -1
    } else  if(pointer.y > -0.05) {
        pointer.y = 0
    }
    if(pointer.x < -0.2) {
        pointer.x = -0.2
    }
    else if(pointer.x > 0.25) {
        pointer.x = 0.25
    }
    if(pointer.y < -0.05){
        arrowMesh.scale.z = pointer.y * -1
        arrowMesh.position.x = pointer.y * -1
        arrowMesh.rotation.y = pointer.x - Math.PI/2
    }
}

let tempQuilles = []
let upQuilles = []
let previousScore = 0
let strike = false
let doubleStrike = false
let doubleStrike2 = false
let spare = false
let wasStrike = false
let wasStrike2 = false
let wasSpare = false
let wasSpare2 = false
let newHighscore = false
let finalScore1 = document.getElementById("finalScore1")
let finalScore2 = document.getElementById("finalScore2")
let finalScoreDiv = document.getElementById("finalDiv")
restartButton.addEventListener('click', () => {
    totalScore = 0
    totalScore2 = 0
    manche = 1
    strike = false
    spare = false
    tir = 1
    Lastnb = 0
    let i = 0
    for(let quille of quilles){
        world.removeBody(quille)
        scene.remove(qMeshes[i])
        i++
    }
    quilles = []
    qMeshes = []
    wasSpare = false
    wasStrike = false
    wasSpare2 = false
    wasStrike2 = false
    tempQuilles = []
    upQuilles = []
    createQuilles()
    playerTurn = 1
    
    for (let manches = 1; manches < 11; manches++){
        for (let tirs = 1; tirs < 3; tirs++){
            let scoreCase = document.getElementById("tir"+tirs+"manche"+manches)
            scoreCase.innerHTML = ""
            let scoreCase2 = document.getElementById("tir"+tirs+"manche"+manches+"_2")
            scoreCase2.innerHTML = ""
        }
        let totalCase = document.getElementById("totalmanche"+manches)
        totalCase.innerHTML = ""
        let totalCase2 = document.getElementById("totalmanche"+manches+"_2")
        totalCase2.innerHTML = ""
    }
    document.getElementById("tir3manche10").innerHTML = ""
    document.getElementById("totalmanche10").innerHTML = ""
    document.getElementById("tir3manche10_2").innerHTML = ""
    document.getElementById("totalmanche10_2").innerHTML = ""
    document.getElementById("total").innerHTML = ""
    document.getElementById("total2").innerHTML = ""
    
    gsap.to(finalScoreDiv, {
        duration: 1,
        ease: "ease.out",
        top: "100vh",
    })

    gsap.to(menuDiv, {
        duration: 1,
        ease: "ease.out",
        top: "0",
    })
    gsap.to(scoreDiv, {
        duration: 1,
        ease: "ease.out",
        left: "-1000px",
    })
    if(twoPlayers){
        gsap.to(scoreDiv2, {
            duration: 1,
            ease: "ease.out",
            right: "-1000px",
        }).then(()=>{
            twoPlayers = false
            world.removeBody(ballBody)
            scene.remove(ballMesh)
            createBall(0.47,{x:-1,y:0.9,z:-0.3})})
    }
})

let handleEnd = () => {
    let h1win = playersFinal.querySelector("h1")
    if(twoPlayers){
        let playersFinal = document.getElementById("playersFinal")
        let playerTwoFinal = document.getElementById("playerTwoFinal")
        playerTwoFinal.style.display = "block"
        h1win.innerHTML = nameplayer.innerHTML + " wins !"
    }
    hishgscoreH1.innerHTML = "All time Highscore : " + highscore + " by " + highscoreName
    if((totalScore > highscore)){
        if(totalScore2 > totalScore && twoPlayers){
            window.localStorage.setItem("highscore", totalScore2)
            window.localStorage.setItem("highscoreName", nameplayer2.innerHTML)
            newHighscore = true
            h1win.innerHTML = nameplayer2.innerHTML + " wins !"
        } else {
            window.localStorage.setItem("highscore", totalScore)
            window.localStorage.setItem("highscoreName", nameplayer.innerHTML)
            newHighscore = true
        }
    } else if(totalScore2 > highscore && twoPlayers){
        window.localStorage.setItem("highscore", totalScore2)
        window.localStorage.setItem("highscoreName", nameplayer2.innerHTML)
        newHighscore = true
        h1win.innerHTML = nameplayer2.innerHTML + " wins !"
    } else if(totalScore2 > totalScore && twoPlayers){
        h1win.innerHTML = nameplayer2.innerHTML + " wins !"
    } else if (totalScore2 == totalScore && twoPlayers){
        h1win.innerHTML = "It's a tie !"
    }
    finishedText.style.display = "grid"
    finishedText.style.opacity = 1
    let announcer = new Audio("/sounds/announcer/finished.mp3")
    let success = new Audio("/sounds/success.mp3")
    success.volume = 0.3
    announcer.volume = 1

    announcer.play()
    success.play()

    gsap.set(finishedText, {
        transform:"translateY(-100vh)"
    })

    gsap.to(finishedText, {

        duration: 1,
        ease: "ease.in",
        transform:"translateY(0vh)"
    }).then(() => {
        gsap.delayedCall(1, () => {
            gsap.to(finishedText, {
                duration: 1,
                ease: "ease.out",
                top: "-100vh",
            }).then(()=>{
                finishedText.style.top = ""
                finishedText.style.opacity = 0
                finishedText.style.scale = 1
            })
            gsap.to(scoreDiv,{
                duration: 1,
                ease: "ease.out",
                left: "-30px",
            })
            if(twoPlayers){
                gsap.to(scoreDiv2,{
                    duration: 1,
                    ease: "ease.out",
                    right: "-30px",
                })
            }
            gsap.to(finalScoreDiv, {
                duration: 1,
                ease: "ease.out",
                top: "0",
            })
            gsap.to(camera.position, {
                duration: 1,
                ease: "power1.in.out",
                x: 0,
                y: 7,
                z: -0.3,
            })
            gsap.to(controls.target, {
                duration: 1,
                ease: "power1.in.out",
                x: -20,
                y: 0,
                z: 13,
            })
            finalScore1.innerHTML = nameplayer.innerHTML + "'s score : " + totalScore
            finalScore2.innerHTML = nameplayer2.innerHTML + "'s score : " + totalScore2
            if(newHighscore){
                hishgscoreH1.innerHTML = "New Highscore : " + totalScore + " by " + nameplayer.innerHTML + " !"
            }
        })
    })
}


let handleTir = (score) =>{
    already = false
    console.log(score)
    let scoreCase = document.getElementById("tir"+tir+"manche"+manche)
    scoreCase.innerHTML = score

    if(score == 10){
        if(tir == 1){
            handleStrikeSpare(strikeText)
            if(wasStrike || wasSpare){
                if(doubleStrike){
                    let totalPrevious = document.getElementById("totalmanche"+(manche-2))
                    totalPrevious.innerHTML = parseInt(totalPrevious.innerHTML) + 10
                    totalScore += 10
                }
                if(wasStrike){
                    doubleStrike = true
                }
                let totalPrevious = document.getElementById("totalmanche"+(manche-1))
                totalPrevious.innerHTML = parseInt(totalPrevious.innerHTML) + 10
                totalScore += 10
                score = 10
            } else {
                doubleStrike = false
            }
            scoreCase.innerHTML = "X"
            wasStrike = true
            wasSpare = false
            strike = true
            console.log("total",totalScore)
        } else if(tir == 2){
            handleStrikeSpare(spareText)
            if(wasStrike){
                let totalPrevious = document.getElementById("totalmanche"+(manche-1))
                totalPrevious.innerHTML = parseInt(totalPrevious.innerHTML) + score
                totalScore += score
            } else {
                doubleStrike = false
            }
            scoreCase.innerHTML = "/"
            wasSpare = true
            wasStrike = false
            spare = true
        }
    } else if(score + previousScore == 10){
        handleStrikeSpare(spareText)
        if(wasStrike){
            let totalPrevious = document.getElementById("totalmanche"+(manche-1))
            totalPrevious.innerHTML = parseInt(totalPrevious.innerHTML) + score
            totalScore += score
            console.log("total",totalScore)

        } 
        wasSpare = true
        wasStrike = false
        scoreCase.innerHTML = "/"
        spare = true
    } else if((tir == 1 && wasSpare)){
        let totalPrevious = document.getElementById("totalmanche"+(manche-1))
        totalPrevious.innerHTML = parseInt(totalPrevious.innerHTML) + score
        totalScore += score
        console.log("total",totalScore)
        wasSpare = false
    }else if(wasStrike){
        console.log(score)
        if(doubleStrike){
            let totalPrevious = document.getElementById("totalmanche"+(manche-2))
            totalPrevious.innerHTML = parseInt(totalPrevious.innerHTML) + score
            totalScore += score
            let totalPrevious2 = document.getElementById("totalmanche"+(manche-1))
            totalPrevious2.innerHTML = parseInt(totalPrevious2.innerHTML) + score + score
            doubleStrike = false
        } else {
            let totalPrevious = document.getElementById("totalmanche"+(manche-1))
            totalPrevious.innerHTML = parseInt(totalPrevious.innerHTML) + score
        }
        totalScore += score
        console.log("total",totalScore)

        if(tir == 2  && manche != 10){
            wasStrike = false
        }
    } 
    else if(tir == 2){
        wasStrike = false
        wasSpare = false
    }

    totalScore += score

    if(tir == 1 && !strike){
        tir = 2
        previousScore = score
        tempQuilles = upQuilles
        console.log(tempQuilles)
    } else if(((tir == 2 || strike) && manche != 10)){
            let totalManche = document.getElementById("totalmanche"+manche)
            strike = false
            spare = false
            manche++

            totalManche.innerHTML = totalScore
            previousScore = 0
            tir = 1
            if(twoPlayers){
                playerTurn = 2
            }
        let i = 0
        for(let quille of quilles){
            world.removeBody(quille)
            scene.remove(qMeshes[i])
            i++
        }
        quilles = []
        qMeshes = []
        tempQuilles = []
        createQuilles()
    } else if (strike && manche == 10 && !spare){
        strike = false
        previousScore = 0
        tir ++
        let i = 0
        for(let quille of quilles){
            world.removeBody(quille)
            scene.remove(qMeshes[i])
            i++
        }
        quilles = []
        qMeshes = []
        tempQuilles = []
        createQuilles()
    } else if(tir == 2 && manche == 10 && !spare && !strike && !wasStrike && !wasSpare){
        let totalManche = document.getElementById("totalmanche"+manche)
        totalManche.innerHTML = totalScore

        tir = 1
        let total = document.getElementById("total")
        total.innerHTML = totalScore


        if(!twoPlayers){
            finished = true
            handleEnd()
        } else {
            let i = 0
            for(let quille of quilles){
                world.removeBody(quille)
                scene.remove(qMeshes[i])
                i++
            }
            quilles = []
            qMeshes = []
            tempQuilles = []
            createQuilles()

            manche++
            playerTurn = 2
        }
    }
    else if(tir == 2 && manche == 10 && wasStrike){
        tir = 3
        previousScore = score
        tempQuilles = upQuilles
    }
    else if(tir == 2 && manche == 10 && spare){
        tir = 3
        spare = false
        previousScore = 0
        let i = 0
        for(let quille of quilles){
            world.removeBody(quille)
            scene.remove(qMeshes[i])
            i++
        }
        quilles = []
        qMeshes = []
        tempQuilles = []
        createQuilles()
    }
    else if(tir == 3){
        tir = 1
        if(wasSpare || wasStrike){
            let totalPrevious = document.getElementById("totalmanche"+(manche-1))
            totalPrevious.innerHTML = parseInt(totalPrevious.innerHTML) + score
            totalScore += score
            console.log("total",totalScore)
        }
        let totalManche = document.getElementById("totalmanche"+manche)
        totalManche.innerHTML = totalScore
        let total = document.getElementById("total")
        total.innerHTML = totalScore
        
        if(!twoPlayers){
            finished = true
            handleEnd()
        } else {
            let i = 0
            for(let quille of quilles){
                world.removeBody(quille)
                scene.remove(qMeshes[i])
                i++
            }
            quilles = []
            qMeshes = []
            tempQuilles = []
            createQuilles()
            manche++
            playerTurn = 2
        }
    }

    if(!finished || twoPlayers){
        gsap.to(scoreDiv, { 
            duration: 0.7,
            ease: "back.out",
            left: "-30px",
        });
        if((tir == 1 || strike) && twoPlayers){
            gsap.to(scoreDiv2, { 
                duration: 0.7,
                ease: "back.out",
                right: "-30px",
            });
        }
    }

}


let handleTir2 = (score) =>{
    already = false
    if(tir == 1){
        manche--
    }
    console.log(score)
    let scoreCase = document.getElementById("tir"+tir+"manche"+manche+"_2")
    console.log("tir"+tir+"manche"+manche+"_2")
    console.log(scoreCase)
    scoreCase.innerHTML = score

    if(score == 10){
        if(tir == 1){
            handleStrikeSpare(strikeText2)
            if(wasStrike2 || wasSpare2){
                if(doubleStrike2){
                    let totalPrevious = document.getElementById("totalmanche"+(manche-2)+"_2")
                    totalPrevious.innerHTML = parseInt(totalPrevious.innerHTML) + 10
                    totalScore2 += 10
                }
                if(wasStrike2){
                    doubleStrike2 = true
                }                
                let totalPrevious = document.getElementById("totalmanche"+(manche-1)+"_2")
                totalPrevious.innerHTML = parseInt(totalPrevious.innerHTML) + 10
                totalScore2 += 10
                score = 10
            } else {
                doubleStrike2 = false
            }
            scoreCase.innerHTML = "X"
            wasStrike2 = true
            wasSpare2 = false
            strike = true
            console.log("total",totalScore2)
        } else if(tir == 2){
            handleStrikeSpare(spareText2)
            if(wasStrike2){
                let totalPrevious = document.getElementById("totalmanche"+(manche-1)+"_2")
                totalPrevious.innerHTML = parseInt(totalPrevious.innerHTML) + score
                totalScore2 += score
                console.log("total",totalScore2)

            } else {
                doubleStrike2 = false
            }
            scoreCase.innerHTML = "/"
            wasSpare2 = true
            wasStrike2 = false
            spare = true
        }

        } else if(score + previousScore == 10){
            handleStrikeSpare(spareText2)
            if(wasStrike2){
                let totalPrevious = document.getElementById("totalmanche"+(manche-1)+"_2")
                totalPrevious.innerHTML = parseInt(totalPrevious.innerHTML) + score
                totalScore2 += score
                console.log("total",totalScore2)

            }
            wasSpare2 = true
            wasStrike2 = false
            scoreCase.innerHTML = "/"
            spare = true
        } else if((tir == 1 && wasSpare2)){
            let totalPrevious = document.getElementById("totalmanche"+(manche-1)+"_2")
            totalPrevious.innerHTML = parseInt(totalPrevious.innerHTML) + score
            totalScore2 += score
            console.log("total",totalScore2)
            wasSpare2 = false
        }else if(wasStrike2){
            console.log(score)
            if(doubleStrike2){
                let totalPrevious = document.getElementById("totalmanche"+(manche-2)+"_2")
                totalPrevious.innerHTML = parseInt(totalPrevious.innerHTML) + score
                totalScore2 += score
                let totalPrevious2 = document.getElementById("totalmanche"+(manche-1)+"_2")
                totalPrevious2.innerHTML = parseInt(totalPrevious2.innerHTML) + score + score
                doubleStrike2 = false
            } else {
                let totalPrevious = document.getElementById("totalmanche"+(manche-1)+"_2")
                totalPrevious.innerHTML = parseInt(totalPrevious.innerHTML) + score
            }
            totalScore2 += score
            console.log("total",totalScore2)

            if(tir == 2  && manche != 10){
                wasStrike2 = false
            }
        }
        else if(tir == 2){
            wasStrike2 = false
            wasSpare2 = false
        }

        totalScore2 += score


        if(tir == 1 && !strike){
            tir = 2
            previousScore = score
            tempQuilles = upQuilles
            console.log(tempQuilles)
        } else if(((tir == 2 || strike) && manche != 10)){
                let totalManche = document.getElementById("totalmanche"+manche+"_2")
                strike = false
                spare = false
                manche++

                totalManche.innerHTML = totalScore2
                previousScore = 0
                tir = 1
                playerTurn = 1
            let i = 0
            for(let quille of quilles){
                world.removeBody(quille)
                scene.remove(qMeshes[i])
                i++
            }
            quilles = []
            qMeshes = []
            tempQuilles = []
            createQuilles()
        }

        else if (strike && manche == 10 && !spare){
            strike = false
            previousScore = 0
            tir ++
            let i = 0
            for(let quille of quilles){
                world.removeBody(quille)
                scene.remove(qMeshes[i])
                i++
            }
            quilles = []
            qMeshes = []
            tempQuilles = []
            createQuilles()
        } else if(tir == 2 && manche == 10 && !spare && !strike && !wasStrike2 && !wasSpare2){
            tir = 3
            previousScore = score
            tempQuilles = upQuilles

            let totalManche = document.getElementById("totalmanche"+manche+"_2")
            totalManche.innerHTML = totalScore2
            let total = document.getElementById("total2")
            total.innerHTML = totalScore2
            finished = true
            handleEnd()
        }

        else if(tir == 2 && manche == 10 && wasStrike2){
            tir = 3
            previousScore = score
            tempQuilles = upQuilles
        }
        else if(tir == 2 && manche == 10 && spare){
            tir = 3
            spare = false
            previousScore = 0
            let i = 0
            for(let quille of quilles){
                world.removeBody(quille)
                scene.remove(qMeshes[i])
                i++
            }
            quilles = []
            qMeshes = []
            tempQuilles = []
            createQuilles()
        }

        else if(tir == 3){
            if(wasSpare2 || wasStrike2){
                let totalPrevious = document.getElementById("totalmanche"+(manche-1)+"_2")
                totalPrevious.innerHTML = parseInt(totalPrevious.innerHTML) + score
                totalScore2 += score
                console.log("total",totalScore2)
            }
            let totalManche = document.getElementById("totalmanche"+manche+"_2")
            totalManche.innerHTML = totalScore2
            let total = document.getElementById("total2")
            total.innerHTML = totalScore2
            finished = true
            handleEnd()
        }

        if(!finished){
            gsap.to(scoreDiv2, { 
                duration: 0.7,
                ease: "back.out",
                right: "-30px",
            });

            if(tir == 1 || strike){
                gsap.to(scoreDiv, { 
                    duration: 0.7,
                    ease: "back.out",
                    left: "-30px",
                });
            }
        }
}


let usernameDiv = document.getElementById("usernameDiv")
let submitUsername1 = document.getElementById("submitUsername1")
let nameplayer = document.getElementById("nameplayer")
let nameplayer2 = document.getElementById("nameplayer2")
let username1Input = document.getElementById("username1Input")
let username2Input = document.getElementById("username2Input")

let handlePlayerClick = () => {
    finished = false

    bg.play()

    gsap.to(usernameDiv, {
        duration: 1,
        ease: "back.out",
        top: "0",
      });
    gsap.to(menuDiv, { 
        duration:1,
        ease: "back.out",
        top: "-100vh",
      }).then(() => {
        submitUsername1.addEventListener('click', () => {
            gsap.to(usernameDiv, {
                duration: 1,
                ease: "back.in",
                top: "-100vh",
              }).then(()=>{
                usernameDiv.style.top = "100vh"

              })
            gsap.to(controls.target, {
                duration: 2,
                ease: "power1.in.out",
                x: 0,
                y: 0,
                z: -0.3,
            })
            gsap.to(camera.position, {
                duration: 2,
                ease: "power1.in.out",
                x: -4,
                y: 2,
                z: -0.3,
            })
            gsap.to(overlayMaterial.uniforms.uAlpha, { duration: 1, value: 0}).then(()=>{
                scene.remove(overlay)
            })
            gsap.to(scoreDiv, { duration: 1, left: "-30px", delay:1})
            if(twoPlayers){
                gsap.to(scoreDiv2, { duration: 1, right: "-30px", delay:1})
            }
            nameplayer.innerHTML = username1Input.value
            resizeName(username1Input.value, nameplayer)
            if(twoPlayers){
                nameplayer2.innerHTML = username2Input.value
                resizeName(username2Input.value, nameplayer2)
            }
        })
    })
}


let handleOnePlayerClick = () => {
    usernameDiv.querySelector("h2").innerHTML = "What's your name ?"
    username2Input.style.display = "none"
    twoPlayers = false
    handlePlayerClick()
}

let handleTwoPlayersClick = () => {
    twoPlayers = true
    usernameDiv.querySelector("h2").innerHTML = "What's your names ?"
    username2Input.style.display = "block"
    handlePlayerClick()
}

let resizeName = (name, domName) => {
    switch (name.length){
        case 1:
            domName.style.fontSize = "4em"
            break
        case 2:
            domName.style.fontSize = "3.5em"
            break
        case 3:
            domName.style.fontSize = "3em"
            break
        case 4:
            domName.style.fontSize = "2.5em"
            break
        case 5:
            domName.style.fontSize = "1.5em"
            break
        case 6:
            domName.style.fontSize = "1.2em"
            break
        case 7:
            domName.style.fontSize = "1em"
            break
        case 8:
            domName.style.fontSize = "0.8em"
            break
        case 9:
            domName.style.fontSize = "0.8em"
            break
        default:
            domName.style.fontSize = "0.7em"
            break
    }
}