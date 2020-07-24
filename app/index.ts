import uws from "uWebSockets.js"
import { MongoClient, ObjectID, Db } from "mongodb"
import config from "./config"

// const app = uws.SSLApp({
//     /* There are more SSL options, cut for brevity */
//     key_file_name: "misc/key.pem",
//     cert_file_name: "misc/cert.pem",
// })
const app = uws.App()
const topic = "change_stream"

type Model = "status" | "user" | "channel"
type Message = {
    operation: string
    model: "status" | "user" | "channel"
    document_id: any
    status?: {
        user_id: string
        channel_id: string
        community_id: string
    }
}

function register(db: Db, model: Model) {
    const collection = db.collection(model)
    collection.watch().on("change", (event) => {
        if (
            event.operationType == "insert" ||
            event.operationType == "update" ||
            event.operationType == "delete"
        ) {
            const _id = event.documentKey._id as ObjectID
            if (_id == null) {
                return
            }
            const message: Message = {
                operation: event.operationType,
                model: model,
                document_id: _id.toHexString(),
            }
            if (
                event.operationType == "insert" ||
                event.operationType == "update"
            ) {
                const { fullDocument } = event
                if (model === "status") {
                    message["status"] = {
                        user_id: fullDocument.user_id,
                        channel_id: fullDocument.channel_id,
                        community_id: fullDocument.community_id,
                    }
                }
            }
            for (let user of users) {
                try {
                    user.publish(topic, JSON.stringify(message), false)
                    // publishは1回行えば全clientに送信される
                    break
                } catch (error) {}
            }
        }
    })
}

async function main() {
    const mongo = new MongoClient(config.mongodb.uri, {
        useUnifiedTopology: true,
        poolSize: config.mongodb.pool_size,
    })
    await mongo.connect()
    const db = mongo.db()
    register(db, "status")
    register(db, "user")
    register(db, "channel")
}

const users = new Set<uws.WebSocket>()

app.ws("/*", {
    idleTimeout: 30,
    maxBackpressure: 1024,
    maxPayloadLength: 1024 * 1024,
    compression: 0,

    open: (user) => {
        users.add(user)
        user.subscribe(topic)
    },
    close: (user) => {
        users.delete(user)
    },
}).listen(config.port, (socket) => {
    if (socket) {
        console.log(`Listening to port ${config.port}`)
        main().catch(console.error)
    }
})
