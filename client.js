import Channel from 'trystereo'
const {Level} = await import('level')

const db = new Level('test', { valueEncoding: 'json' })

export const channel = new Channel('ws://retested.club:10509/announce', '7e6520e2fe505702ec644226ccb0a8bc467c5a2c', {max: 6, min: 3})

const onConnect = (chan) => {
    chan.server = null
    chan.client = null
    chan.onMsg = async (msg) => {
        try {
            msg = JSON.parse(msg)
        } catch (error) {
            console.error(error)
            return
        }
        if(msg.method === 'init'){
            initialize(msg, chan)
        }
        if(msg.method === 'abort'){
            await trash(msg)
        }
        if(msg.method === 'request'){
            await relay(msg, chan)
        }
        if(msg.method === 'response'){
            await handle(msg, chan)
        }
        if(msg.method === 'zero'){
            await again(msg, chan)
        }
    }
    chan.on('message', chan.onMsg)
    chan.send(JSON.stringify({method: 'init', init: false, proto: null}))
}
const onDisconnect = (chan) => {
    chan.off('message', chan.onMsg)
}

const onError = (e) => {
    console.error(e)
}

channel.on('connect', onConnect)
channel.on('error', onError)
channel.on('disconnect', onDisconnect)

async function again(data, chan){
    const check = await db.get(data.id)
    let base
    if(check){
        if(data.method === 'request'){
            data.method = 'zero'
            chan.send(JSON.stringify(data))
            return
        }
        base = check
    } else {
        base = {relay: chan.id, tried: []}
        await db.put(data.id, base)
    }

    const arr = []
    for(const prop of channel.channels.values()){
        arr.push(prop)
    }
    const notTried = arr.filter((datas) => {return !base.tried.includes(datas.id)})
    const servers = notTried.filter((datas) => {return datas.server && datas.proto.includes(data.proto)})
    const i = servers[Math.floor(Math.random() * servers.length)]
    if(i){
        if(data.method === 'zero'){
            data.method = 'request'
        }
        i.send(JSON.stringify(data))
        base.tried.push(i.id)
        await db.put(data.id, base)
    } else {
        const clients = notTried.filter((datas) => {return datas.client})
        const e = clients[Math.floor(Math.random() * clients.length)]
        if(e){
            if(data.method === 'zero'){
                data.method = 'request'
            }
            e.send(JSON.stringify(data))
            base.tried.push(i.id)
            await db.put(data.id, base)
        } else {
            if(channel.channels.has(base.relay)){
                const sendToChannel = channel.channels.get(base.relay)
                if(data.method === 'request'){
                    data.method = 'zero'
                }
                sendToChannel.send(JSON.stringify(data))
            }
            await db.del(data.id)
        }
    }
}

function initialize(msg, chan){
    if(msg.init){
        chan.server = true
        chan.client = false
        if(msg.proto){
            chan.proto = msg.proto
        } else {
            chan.proto = []
        }
    } else {
        chan.server = false
        chan.client = true
        if(msg.proto){
            chan.proto = msg.proto
        } else {
            chan.proto = []
        }
    }
}

async function trash(msg){
    const check = await db.get(msg.id)
    if(check){
        if(channel.channels.has(check)){
            channel.channels.get(check).send(msg)
        }
        await db.del(msg.id)
    }
}

async function handle(msg, chan){
    if(msg.client === channel.id){
        channel.emit('search', msg, msg.server)
    } else {
        const check = await db.get(msg.id)
        if(check && channel.channels.has(check.relay)){
            channel.channels.get(check.relay).send(JSON.stringify(msg))
            await db.del(msg.id)
        } else {
            msg.method = 'abort'
            chan.send(JSON.stringify(msg))
            await db.del(msg.id)
        }
    }
}

async function relay(obj, chan){
    const arr = []
    for(const prop of channel.channels.values()){
        arr.push(prop)
    }
    let base
    const test = await db.get(obj.id)
    if(test){
        obj.method = 'zero'
        chan.send(JSON.stringify(msg))
        return
    } else {
        base = {relay: chan.id, tried: []}
        await db.put(data.id, base)
    }
    const notTried = arr.filter((data) => {return !base.includes(data.id)})
    const servers = notTried.filter((data) => {return data.server && data.proto.includes(obj.proto)})
    const i = servers[Math.floor(Math.random() * servers.length)]
    if(i){
        if(obj.method === 'zero'){
            obj.method = 'request'
        }
        i.send(JSON.stringify(obj))
        base.tried.push(i.id)
        await db.put(obj.id, base)
    } else {
        const clients = notTried.filter((data) => {return data.client})
        const e = clients[Math.floor(Math.random() * clients.length)]
        if(e){
            if(obj.method === 'zero'){
                obj.method = 'request'
            }
            e.send(JSON.stringify(obj))
            base.tried.push(i.id)
            await db.put(obj.url, base)
        } else {
            if(channel.channels.has(base.relay)){
                const sendToChannel = channel.channels.get(base.relay)
                if(data.method === 'request'){
                    data.method = 'zero'
                }
                sendToChannel.send(JSON.stringify(obj))
            }
            await db.del(data.id)
        }
    }
}

export async function search(url){
    const obj = {client: channel.id, method: 'request', data: url, id: Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder("utf-8").encode(channel.id + '-' + url)))).map((b) => b.toString(16).padStart(2, '0')).join('')}
    if(!obj.proto){
        obj.proto = new URL(obj.url).protocol
    }
    const arr = []
    for(const prop of channel.channels.values()){
        arr.push(prop)
    }
    let base
    const test = await db.get(obj.id)
    if(test){
        base = test
    } else {
        base = []
        await db.put(obj.id, base)
    }
    const notTried = arr.filter((data) => {return !base.includes(data.id)})
    const servers = notTried.filter((data) => {return data.server && data.proto.includes(obj.proto)})
    const i = servers[Math.floor(Math.random() * servers.length)]
    if(i){
        if(obj.method === 'zero'){
            obj.method = 'request'
        }
        i.send(JSON.stringify(obj))
        base.push(i.id)
        await db.put(obj.id, base)
    } else {
        const clients = notTried.filter((data) => {return data.client})
        const e = clients[Math.floor(Math.random() * clients.length)]
        if(e){
            if(obj.method === 'zero'){
                obj.method = 'request'
            }
            e.send(JSON.stringify(obj))
            base.push(i.id)
            await db.put(obj.url, base)
        } else {
            await db.del(obj.id)
            channel.emit('error', new Error('could not find ' + obj.url))
        }
    }
}