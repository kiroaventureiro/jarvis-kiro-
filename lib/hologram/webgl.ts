import { createGeometry } from "./geometry";
export type HologramRenderer = {
  draw: (time: number, energy: number, motion: number, dpr: number) => void;
  dispose: () => void;
  particles: number;
};
const vertex = `
precision mediump float;
attribute vec3 a_position;
attribute float a_family, a_arc, a_alpha, a_size;
uniform float u_time, u_aspect, u_energy, u_points, u_dpr, u_motion;
uniform vec2 u_offset;
varying vec4 v_color;
void main() {
 vec3 p=a_position;
 float t=u_time;
 if(a_family<.5) {
   float c=cos(t*.065),s=sin(t*.065);
   p=vec3(p.x*c+p.z*s,p.y,-p.x*s+p.z*c);
   c=cos(.18+sin(t*.08)*.1);s=sin(.18+sin(t*.08)*.1);
   p=vec3(p.x,p.y*c-p.z*s,p.y*s+p.z*c);
 } else {
   float tilt=.3,roll=.1,r=1.45,speed=.35;
   if(a_family>1.5){tilt=-.42;roll=-.26;r=1.36;speed=-.28;}
   if(a_family>2.5){tilt=.61;roll=.51;r=1.25;speed=.23;}
   if(a_family>3.5){tilt=-.64;roll=-.48;r=1.3;speed=-.19;}
   float a=a_arc*6.283185 + t*speed*u_points;
   float x=cos(a)*r,y=sin(a)*r*sin(tilt),z=sin(a)*r*cos(tilt);
   roll+=sin(t*.08+a_family)*.07;
   p=vec3(x*cos(roll)-y*sin(roll),x*sin(roll)+y*cos(roll),z);
 }
 float depth=clamp((p.z+1.5)/3.,0.,1.);
 float spark=pow(max(0.,sin(a_arc*18.8495-t*(.55+a_family*.14))),12.);
 float front=.38+.62*depth;
 float intensity=a_alpha*front*(.9+spark*1.7)*u_energy*2.5;
 vec3 cyan=mix(vec3(.025,.27,1.),vec3(.28,.88,1.),depth);
 if(a_family>2.5)cyan=mix(cyan,vec3(.39,.26,1.),.26);
 v_color=vec4(cyan,intensity);
 float perspective=4.8/(4.8-p.z*.13);
 gl_Position=vec4(p.x*.78/u_aspect*perspective,p.y*.78*perspective,0.,1.);
 gl_Position.xy+=u_offset;
 gl_PointSize=min(46.,a_size*u_dpr*(.7+depth*.6)*(u_energy*.25+.75));
}
`;
const fragment = `
precision mediump float;
varying vec4 v_color;
uniform float u_points;
void main() {
 float alpha=v_color.a;
 vec3 color=v_color.rgb;
 if(u_points>.5) {
   float r=length(gl_PointCoord-.5);
   float star=(exp(-abs(gl_PointCoord.x-.5)*65.)+exp(-abs(gl_PointCoord.y-.5)*65.))*exp(-r*8.)*.45;
   alpha*=exp(-r*r*23.)*.65+exp(-r*r*200.)*.9+star;
   color=mix(color,vec3(.88,.99,1.),exp(-r*r*160.));
 }
 gl_FragColor=vec4(color,alpha);
}
`;
const quadVertex = `
attribute vec2 a_position;
varying vec2 v_position;
void main(){v_position=a_position;gl_Position=vec4(a_position,0.,1.);}
`;
const shellFragment = `
precision mediump float;
varying vec2 v_position;
uniform float u_aspect,u_energy,u_time;
void main(){
 vec2 p=vec2(v_position.x*u_aspect,v_position.y)/.78;
 float r=length(p),inside=1.-smoothstep(.985,1.015,r);
 float z=sqrt(max(0.,1.-r*r));
 float rim=pow(1.-z,3.5)*inside;
 float edge=exp(-pow((r-1.)*43.,2.));
 float outer=exp(-abs(r-1.)*11.)*.19;
 float central=exp(-r*r*3.2);
 float light=pow(max(0.,dot(normalize(vec3(p,z)),normalize(vec3(-.4,.6,.5)))),9.);
 vec3 color=vec3(.02,.22,.7)*(inside*.15+central*.5)
  +vec3(.08,.63,1.)*(rim*.42+edge*.75+outer)
  +vec3(.12,.95,1.3)*(light*.8+central*.95);
 gl_FragColor=vec4(color*u_energy,clamp((inside*.32+rim*.32+edge*.6+outer+central*.5)*u_energy,0.,.9));
}
`;
export function createHologramRenderer(
  canvas: HTMLCanvasElement,
  particleLimit: number,
): HologramRenderer | null {
  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: false,
    premultipliedAlpha: false,
    depth: false,
    stencil: false,
    powerPreference: "low-power",
  });
  if (!gl) return null;
  const shaders: WebGLShader[] = [],
    programs: WebGLProgram[] = [],
    buffers: WebGLBuffer[] = [];
  const dispose = () => {
    for (const b of buffers) gl.deleteBuffer(b);
    for (const p of programs) gl.deleteProgram(p);
    for (const s of shaders) gl.deleteShader(s);
  };
  try {
    function compile(type: number, text: string) {
      const shader = gl!.createShader(type);
      if (!shader) throw Error("shader");
      shaders.push(shader);
      gl!.shaderSource(shader, text);
      gl!.compileShader(shader);
      if (!gl!.getShaderParameter(shader, gl!.COMPILE_STATUS))
        throw Error("shader");
      return shader;
    }
    function program(v: string, f: string) {
      const p = gl!.createProgram();
      if (!p) throw Error("program");
      programs.push(p);
      gl!.attachShader(p, compile(gl!.VERTEX_SHADER, v));
      gl!.attachShader(p, compile(gl!.FRAGMENT_SHADER, f));
      gl!.linkProgram(p);
      if (!gl!.getProgramParameter(p, gl!.LINK_STATUS)) throw Error("program");
      return p;
    }
    function buffer(data: Float32Array) {
      const b = gl!.createBuffer();
      if (!b) throw Error("buffer");
      buffers.push(b);
      gl!.bindBuffer(gl!.ARRAY_BUFFER, b);
      gl!.bufferData(gl!.ARRAY_BUFFER, data, gl!.STATIC_DRAW);
      return b;
    }
    const shell = program(quadVertex, shellFragment),
      wire = program(vertex, fragment);
    const geometry = createGeometry(particleLimit);
    const plane = buffer(
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    );
    const lines = buffer(geometry.lines),
      points = buffer(geometry.points);
    const shellPosition = gl.getAttribLocation(shell, "a_position");
    const attributes = [
      "a_position",
      "a_family",
      "a_arc",
      "a_alpha",
      "a_size",
    ].map((name) => gl.getAttribLocation(wire, name));
    const uniforms = (p: WebGLProgram) =>
      Object.fromEntries(
        [
          "u_time",
          "u_aspect",
          "u_energy",
          "u_points",
          "u_dpr",
          "u_motion",
          "u_offset",
        ].map((name) => [name, gl.getUniformLocation(p, name)]),
      );
    const shellUniforms = uniforms(shell),
      wireUniforms = uniforms(wire);
    gl.enable(gl.BLEND);
    let disposed = false;
    return {
      particles: geometry.particles,
      draw(time, energy, motion, dpr) {
        if (disposed || gl.isContextLost()) return;
        const aspect = canvas.width / canvas.height;
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.useProgram(shell);
        gl.bindBuffer(gl.ARRAY_BUFFER, plane);
        gl.enableVertexAttribArray(shellPosition);
        gl.vertexAttribPointer(shellPosition, 2, gl.FLOAT, false, 0, 0);
        gl.uniform1f(shellUniforms.u_aspect, aspect);
        gl.uniform1f(shellUniforms.u_energy, energy);
        gl.uniform1f(shellUniforms.u_time, time);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.disableVertexAttribArray(shellPosition);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        gl.useProgram(wire);
        gl.uniform1f(wireUniforms.u_time, time);
        gl.uniform1f(wireUniforms.u_aspect, aspect);
        gl.uniform1f(wireUniforms.u_energy, energy);
        gl.uniform1f(wireUniforms.u_dpr, dpr);
        gl.uniform1f(wireUniforms.u_motion, motion);
        const draw = (b: WebGLBuffer, count: number, point: boolean) => {
          gl.bindBuffer(gl.ARRAY_BUFFER, b);
          let offset = 0;
          attributes.forEach((location, i) => {
            if (location >= 0) {
              gl.enableVertexAttribArray(location);
              gl.vertexAttribPointer(
                location,
                i === 0 ? 3 : 1,
                gl.FLOAT,
                false,
                28,
                offset * 4,
              );
            }
            offset += i === 0 ? 3 : 1;
          });
          gl.uniform1f(wireUniforms.u_points, point ? 1 : 0);
          gl.drawArrays(point ? gl.POINTS : gl.LINES, 0, count / 7);
          attributes.forEach((location) => {
            if (location >= 0) gl.disableVertexAttribArray(location);
          });
        };
        gl.uniform2f(wireUniforms.u_offset, 1 / canvas.width, 0);
        draw(lines, geometry.lines.length, false);
        gl.uniform2f(wireUniforms.u_offset, 0, 1 / canvas.height);
        draw(lines, geometry.lines.length, false);
        gl.uniform2f(wireUniforms.u_offset, 0, 0);
        draw(lines, geometry.lines.length, false);
        draw(points, geometry.points.length, true);
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        dispose();
      },
    };
  } catch {
    dispose();
    return null;
  }
}
