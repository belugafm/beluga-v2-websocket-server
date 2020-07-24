const config: {
    mongodb: {
        uri: string
        pool_size: number
    }
    port: number
} = {
    mongodb: {
        uri: "mongo://127.0.0.1:27017/your_db_name",
        pool_size: 10,
    },
    port: 9001,
}

export default config
