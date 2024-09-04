const __dirname = import.meta.dirname
import Channel from 'trystereo'
const {Level} = await import('level')
import Torrentz from 'torrentz'
import {createHelia} from 'helia'
import {kadDHT} from '@libp2p/kad-dht'
import {gossipsub} from '@chainsafe/libp2p-gossipsub'
import Holepunch from 'hyper-sdk'
import {Buffer} from 'buffer'
import {makeHTTP, makeGemini, makeGopher, makeBTFetch, makeIPFSFetch, makeHyperFetch, makeOnion, makeGarlic, makeIndex} from 'fetchize'

const db = new Level('test', { valueEncoding: 'json' })

const proto = {}

proto['bt:'] = await (async () => {
    if(opts.bt){
        if(opts.bt === true){
            const bt = (await Torrentz())(opts.torrentz || {})
            return makeBTFetch({torrentz: bt})
        } else {
            return makeBTFetch({torrentz: opts.bt})
        }
    } else {
        return null
    }
})()

proto['ipfs:'] = await (async () => {
    if(opts.ipfs){
        if(opts.ipfs === true){
            const {FsDatastore} = await import('datastore-fs')
            const {FsBlockstore} = await import('blockstore-fs')
            const ipfs = await createHelia(opts.helia || {blockstore: new FsBlockstore(opts.blockstore || __dirname), datastore: new FsDatastore(opts.datastore || __dirname), libp2p: {services: {dht: kadDHT(opts.kadDHT || {}), pubsub: gossipsub(opts.gossipsub || {})}}})
            return makeIPFSFetch({helia: ipfs})
        } else {
            return makeIPFSFetch({helia: opts.ipfs})
        }
    } else {
        return null
    }
})()

proto['hyper:'] = await (async () => {
    if(opts.hyper){
        if(opts.hyper === true){
            const hyper = await Holepunch.create(opts.holepunch || {})
            return makeHyperFetch({sdk: hyper})
        } else {
            return makeHyperFetch({sdk: opts.hyper})
        }
    } else {
        return null
    }
})()

proto['http:'] = opts.http === true ? makeHTTP() : opts.http ? opts.http : null
proto['https:'] = proto['http:']
proto['gemini:'] = opts.gemini === true ? makeGemini() : opts.gemini ? opts.gemini : null
proto['gopher'] = opts.gopher === true ? makeGopher() : opts.gopher ? opts.gopher : null
proto['tor:'] = opts.tor === true ? makeOnion() : opts.tor ? opts.tor : null
proto['iip:'] = opts.iip === true ? makeGarlic() : opts.iip ? opts.iip : null
proto['oui:'] = opts.oui === true ? makeIndex() : opts.oui ? opts.oui : null

const funcs = Object.keys(proto).filter((data) => {return proto[data]})

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
        if(msg.method === 'request'){
            const check = await db.get(msg.id)
            if(check){
                msg.method = 'abort'
                chan.send(JSON.stringify(msg))
            } else {
                const msgProto = new URL(msg.data).protocol
                if(funcs.includes(msgProto)){
                    try {
                        const test = await proto[msgProto](new Request(msg.data, {headers: msg.req || {}}))
                        const body = Buffer.from(await test.arrayBuffer()).toString('utf-8')
                        msg.method = 'response'
                        msg.server = channel.id
                        msg.res = Object.fromEntries(test.headers)
                        msg.data = body
                        msg.status = 200
                        chan.send(JSON.stringify(msg))
                        await db.put(msg.id, chan.id)
                    } catch (error) {
                        msg.res = {'X-Error': error.name}
                        msg.method = 'response'
                        msg.data = error.message
                        msg.server = channel.id
                        msg.status = 400
                        chan.send(JSON.stringify(msg))
                        await db.put(msg.id, chan.id)
                    }
                } else {
                    msg.method = 'zero'
                    // msg.res = {'X-Error': 'ProtocolError'}
                    // msg.data = 'protocol is not supported by server'
                    // msg.status = 500
                    msg.server = channel.id
                    chan.send(JSON.stringify(msg))
                    await db.put(msg.id, chan.id)
                }
            }
        }
        if(msg.method === 'response'){
            msg.method = 'zero'
            chan.send(JSON.stringify(msg))
        }
    }
    chan.on('message', chan.onMsg)
    chan.send(JSON.stringify({method: 'init', init: true, proto}))
}
const onDisconnect = (chan) => {
    chan.off('message', chan.onMsg)
}

channel.on('connect', onConnect)
channel.on('disconnect', onDisconnect)

export async function link(search){
    const msg = new URL(search).protocol
    if(proto[msg]){
        const test = await proto[msg](new Request(search, {}))
        const text = await test.text()
        channel.emit('link', text, search)
    } else {
        channel.emit('error', new Error('protocol is not supported'))
    }
}