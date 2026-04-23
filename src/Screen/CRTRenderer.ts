const VERTEX_SHADER = `#version 300 es
out vec2 v_uv;
void main() {
    vec2 positions[6] = vec2[](
        vec2(-1.0, -1.0),
        vec2( 1.0, -1.0),
        vec2(-1.0,  1.0),
        vec2(-1.0,  1.0),
        vec2( 1.0, -1.0),
        vec2( 1.0,  1.0)
    );
    vec2 pos = positions[gl_VertexID];
    v_uv = pos * 0.5 + 0.5;
    v_uv.y = 1.0 - v_uv.y;
    gl_Position = vec4(pos, 0.0, 1.0);
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_texture;
uniform vec2 u_outputResolution;
uniform vec2 u_sourceResolution;
uniform float u_time;

vec2 curve(vec2 uv) {
    float curve_x = 5.5 * 1.0; // default: 5.5
    float curve_y = 4.2 * 1.0; // default: 4.2

    uv = uv * 2.0 - 1.0;
    vec2 offset = abs(uv.yx) / vec2(curve_x, curve_y);
    uv = uv + uv * offset * offset;
    uv = uv * 0.5 + 0.5;
    return uv;
}

void main() {
    vec2 uv = curve(v_uv);

    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        fragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }

    float ca = 0.0018; // tune how much chromatic aberration happens
    vec3 col;
    col.r = texture(u_texture, vec2(uv.x + ca, uv.y)).r;
    col.g = texture(u_texture, uv).g;
    col.b = texture(u_texture, vec2(uv.x - ca, uv.y)).b;

    float scan = 0.5 + 0.5 * cos(uv.y * u_sourceResolution.y * 3.14159 * 2.0);

    // mixing in scan lines
    col *= mix(0.75, 1.0, scan);

    float grille = 0.9 + 0.1 * sin(uv.x * u_outputResolution.x * 1.5);
    col *= grille;

    float vignette_strength = 0.85;
    vec2 vc = uv - 0.5;
    float vignette = 1.0 - dot(vc, vc) * vignette_strength;
    vignette = clamp(vignette, 0.0, 1.0);
    vignette = pow(vignette, 1.3);
    col *= vignette;

    col *= 1.18;

    col *= 0.985 + 0.015 * sin(u_time * 12.0);

    fragColor = vec4(col, 1.0);
}`;

export class CRTRenderer {
    private canvas: HTMLCanvasElement;
    private gl: WebGL2RenderingContext;
    private program: WebGLProgram;
    private vao: WebGLVertexArrayObject;
    private texture: WebGLTexture;
    private uTextureLoc: WebGLUniformLocation | null;
    private uOutputResolutionLoc: WebGLUniformLocation | null;
    private uSourceResolutionLoc: WebGLUniformLocation | null;
    private uTimeLoc: WebGLUniformLocation | null;
    private startTime: number;
    private resizeObserver: ResizeObserver;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;

        const gl = canvas.getContext("webgl2", {
            alpha: false,
            antialias: false,
            premultipliedAlpha: false,
            preserveDrawingBuffer: false,
        });

        if (!gl) {
            throw new Error("WebGL2 is not supported in this browser");
        }

        this.gl = gl;

        this.program = this._createProgram(VERTEX_SHADER, FRAGMENT_SHADER);

        this.uTextureLoc = gl.getUniformLocation(this.program, "u_texture");
        this.uOutputResolutionLoc = gl.getUniformLocation(
            this.program,
            "u_outputResolution",
        );
        this.uSourceResolutionLoc = gl.getUniformLocation(
            this.program,
            "u_sourceResolution",
        );
        this.uTimeLoc = gl.getUniformLocation(this.program, "u_time");

        this.vao = gl.createVertexArray()!;

        this.texture = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        this.startTime = performance.now();

        this._syncBackingSize();
        this.resizeObserver = new ResizeObserver(() => this._syncBackingSize());
        this.resizeObserver.observe(canvas);
    }

    private _syncBackingSize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const rect = this.canvas.getBoundingClientRect();
        const w = Math.max(1, Math.floor(rect.width * dpr));
        const h = Math.max(1, Math.floor(rect.height * dpr));
        if (this.canvas.width !== w || this.canvas.height !== h) {
            this.canvas.width = w;
            this.canvas.height = h;
        }
    }

    private _createShader(type: number, source: string): WebGLShader {
        const gl = this.gl;
        const shader = gl.createShader(type)!;
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const log = gl.getShaderInfoLog(shader);
            gl.deleteShader(shader);
            throw new Error(`Shader compile error: ${log}`);
        }
        return shader;
    }

    private _createProgram(vsSource: string, fsSource: string): WebGLProgram {
        const gl = this.gl;
        const vs = this._createShader(gl.VERTEX_SHADER, vsSource);
        const fs = this._createShader(gl.FRAGMENT_SHADER, fsSource);
        const program = gl.createProgram()!;
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            const log = gl.getProgramInfoLog(program);
            gl.deleteProgram(program);
            throw new Error(`Program link error: ${log}`);
        }
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        return program;
    }

    public render(source: HTMLCanvasElement) {
        const gl = this.gl;

        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            source,
        );

        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(this.program);
        gl.bindVertexArray(this.vao);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        if (this.uTextureLoc) {
            gl.uniform1i(this.uTextureLoc, 0);
        }
        if (this.uOutputResolutionLoc) {
            gl.uniform2f(
                this.uOutputResolutionLoc,
                this.canvas.width,
                this.canvas.height,
            );
        }
        if (this.uSourceResolutionLoc) {
            gl.uniform2f(
                this.uSourceResolutionLoc,
                source.width,
                source.height,
            );
        }
        if (this.uTimeLoc) {
            gl.uniform1f(
                this.uTimeLoc,
                (performance.now() - this.startTime) / 1000,
            );
        }

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    public dispose() {
        const gl = this.gl;
        this.resizeObserver.disconnect();
        gl.deleteTexture(this.texture);
        gl.deleteVertexArray(this.vao);
        gl.deleteProgram(this.program);
    }
}
