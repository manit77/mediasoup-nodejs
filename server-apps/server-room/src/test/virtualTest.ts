//mimic a scenario where many clients connect and disconnect

//four peers join the room at different times
let testScenariosRoom1 = [
    {
        registerPeer: 1000,
        getRoomToken: 1500,
        joinRoom: 1000,
        leaveRoom: 1000
    },
    {
        registerPeer: 1010,
        getRoomToken: 1500,
        joinRoom: 1000,
        leaveRoom: 1000
    },
    {
        registerPeer: 10100,
        getRoomToken: 1500,
        joinRoom: 1000,
        leaveRoom: 1000
    },
    {
        registerPeer: 10100,
        getRoomToken: 1500,
        joinRoom: 1000,
        leaveRoom: 1000
    }, {
        registerPeer: 10100,
        getRoomToken: 1500,
        joinRoom: 1000,
        leaveRoom: 1000
    }
]

let testScenariosRoom2 = [
    {
        registerPeer: 1000,
        getRoomToken: 1500,
        joinRoom: 1000,
        leaveRoom: 1000
    },
    {
        registerPeer: 1010,
        getRoomToken: 1500,
        joinRoom: 1000,     
    }    
]

let testScenariosRoom3 = []

let testScenariosRoom4 = [
    {
        registerPeer: 1000,
        getRoomToken: 1500,
        joinRoom: 1000,
        leaveRoom: 1000
    },
    {
        registerPeer: 2000,
        getRoomToken: 1500,
        joinRoom: 1000,     
    }    
]

let roomsScenarios = [testScenariosRoom1, testScenariosRoom2, testScenariosRoom3, testScenariosRoom4];


for(let roomS of roomsScenarios) {

    

}

