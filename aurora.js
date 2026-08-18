/* Aurora background - WebGL2 port of ReactBits Aurora shader */
(function () {
  'use strict';
  var VERT = "#version 300 es\nin vec2 position;void main(){gl_Position=vec4(position,0.0,1.0);}";
  var FRAG = "#version 300 es\nprecision highp float;\nuniform float uTime;uniform float uAmplitude;uniform vec3 uColorStops[3];uniform vec2 uResolution;uniform float uBlend;out vec4 fragColor;vec3 permute(vec3 x){return mod(((x*34.0)+1.0)*x,289.0);}float snoise(vec2 v){const vec4 C=vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);vec2 i=floor(v+dot(v,C.yy));vec2 x0=v-i+dot(i,C.xx);vec2 i1=(x0.x>x0.y)?vec2(1.0,0.0):vec2(0.0,1.0);vec4 x12=x0.xyxy+C.xxzz;x12.xy-=i1;i=mod(i,289.0);vec3 p=permute(permute(i.y+vec3(0.0,i1.y,1.0))+i.x+vec3(0.0,i1.x,1.0));vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.0);m=m*m;m=m*m;vec3 x=2.0*fract(p*C.www)-1.0;vec3 h=abs(x)-0.5;vec3 ox=floor(x+0.5);vec3 a0=x-ox;m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);vec3 g;g.x=a0.x*x0.x+h.x*x0.y;g.yz=a0.yz*x12.xz+h.yz*x12.yw;return 130.0*dot(m,g);}struct ColorStop{vec3 color;float position;};vec3 colorRamp(ColorStop colors[3],float factor){int index=0;for(int i=0;i<2;i++){if(colors[i].position<=factor){index=i;}}ColorStop currentColor=colors[index];ColorStop nextColor=colors[index+1];float range=nextColor.position-currentColor.position;float lerpFactor=(factor-currentColor.position)/max(range,1e-5);return mix(currentColor.color,nextColor.color,lerpFactor);}\nvoid main(){vec2 uv=gl_FragCoord.xy/uResolution;ColorStop colors[3];colors[0]=ColorStop(uColorStops[0],0.0);colors[1]=ColorStop(uColorStops[1],0.5);colors[2]=ColorStop(uColorStops[2],1.0);vec3 rampColor=colorRamp(colors,uv.x);float height=snoise(vec2(uv.x*2.0+uTime*0.1,uTime*0.25))*0.5*uAmplitude;height=exp(height);height=(uv.y*2.0-height+0.2);float intensity=0.6*height;float midPoint=0.20;float auroraAlpha=smoothstep(midPoint-uBlend*0.5,midPoint+uBlend*0.5,intensity);vec3 auroraColor=intensity*rampColor;fragColor=vec4(auroraColor*auroraAlpha,auroraAlpha);}";

  function hexToRgb(hex) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
  }

  function compile(gl, type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(sh));
      return null;
    }
    return sh;
  }

  function initAurora(el) {
    if (!el || !window.WebGL2RenderingContext) return;
    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
    el.appendChild(canvas);
    var gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: true });
    if (!gl) return;
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    var prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(prog));
      return;
    }
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'position');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    var stops = (el.dataset.stops || '#d9c6ad,#f3e9dc,#e6c9a8').split(',').map(hexToRgb);
    var uTime = gl.getUniformLocation(prog, 'uTime');
    var uAmplitude = gl.getUniformLocation(prog, 'uAmplitude');
    var uStops = gl.getUniformLocation(prog, 'uColorStops');
    var uRes = gl.getUniformLocation(prog, 'uResolution');
    var uBlend = gl.getUniformLocation(prog, 'uBlend');
    gl.uniform3fv(uStops, new Float32Array(stops.flat()));
    gl.uniform1f(uAmplitude, parseFloat(el.dataset.amplitude || '1'));
    gl.uniform1f(uBlend, parseFloat(el.dataset.blend || '0.5'));

    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var raf = null;
    var start = performance.now();

    function resize() {
      var r = el.getBoundingClientRect();
      var w = Math.round(r.width), h = Math.round(r.height);
      if (!w || !h) return;
      canvas.width = w; canvas.height = h;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uRes, w, h);
    }
    function initResize() {
      resize();
      window.addEventListener('resize', resize);
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initResize);
    } else {
      requestAnimationFrame(function () { requestAnimationFrame(initResize); });
    }

    if (reduced) {
      gl.uniform1f(uTime, 3.0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      return;
    }

    function tick() {
      gl.uniform1f(uTime, (performance.now() - start) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(tick);
    }
    tick();
  }

  document.querySelectorAll('.aurora-webgl').forEach(initAurora);
})();
