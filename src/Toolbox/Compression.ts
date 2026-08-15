/* gzip compression with native browser APIs */

async function fullReadStream(stream: ReadableStream): Promise<ArrayBuffer> {
    const reader = stream.getReader();
    const chunks = [];
    while(1) {
        const { value, done } = await reader.read();
        if(done) break;
        chunks.push(value);
    }

    const len = chunks.reduce((a, chunk) => a + chunk.byteLength, 0);
    const buf = new ArrayBuffer(len);
    const arr = new Uint8Array(buf);
    let ptr = 0;
    for(const c of chunks) {
        arr.set(c, ptr);
        ptr += c.byteLength;
    }
    return buf;
}

export async function gzip(data: string): Promise<ArrayBuffer> {
    const byteArray = new TextEncoder().encode(data);
    const compressStream = new CompressionStream("gzip");
    const writer = compressStream.writable.getWriter();
    writer.write(byteArray);
    writer.close();
    // must use fullReadStream here and below because
    // `new Response(...).arrayBuffer()` throws an error
    // that is impossible to catch on invaild input
    return await fullReadStream(compressStream.readable);
}

export async function gunzip(bytes: Uint8Array): Promise<ArrayBuffer> {
    const decompStream = new DecompressionStream("gzip");
    const writer = decompStream.writable.getWriter();
    // the error this produces is pure delusion
    writer.write(bytes as any);
    writer.close();
    return await fullReadStream(decompStream.readable);
}

