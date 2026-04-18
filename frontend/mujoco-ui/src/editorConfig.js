export const PROVIDERS = {
  ollama: {
    label: "Ollama",
    icon: "🦙",
    color: "#a78bfa",
    needsKey: false,
    models: [],
    defaultModel: "qwen2.5:7b",
    defaultTimeoutSeconds: 300,
    defaultNumPredict: 8192,
  },
  anthropic: {
    label: "Anthropic",
    icon: "◆",
    color: "#f97316",
    needsKey: true,
    models: [
      "claude-sonnet-4-20250514",
      "claude-opus-4-20250514",
      "claude-haiku-4-5-20251001",
    ],
    defaultModel: "claude-sonnet-4-20250514",
  },
  openai: {
    label: "OpenAI",
    icon: "⬡",
    color: "#22c55e",
    needsKey: true,
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
    defaultModel: "gpt-4o",
  },
  gemini: {
    label: "Gemini",
    icon: "✦",
    color: "#3b82f6",
    needsKey: true,
    models: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.0-flash"],
    defaultModel: "gemini-1.5-pro",
  },
  groq: {
    label: "Groq",
    icon: "⚡",
    color: "#eab308",
    needsKey: true,
    models: ["llama-3.3-70b-versatile", "mixtral-8x7b-32768", "llama3-70b-8192"],
    defaultModel: "llama-3.3-70b-versatile",
  },
};

export const DEFAULT_XML = `<mujoco model="simple_robot">
  <option gravity="0 0 -9.81" timestep="0.002"/>
  <asset>
    <material name="body_mat"   rgba="0.3 0.6 0.9 1"/>
    <material name="joint_mat"  rgba="0.9 0.5 0.2 1"/>
    <material name="ground_mat" rgba="0.15 0.15 0.18 1"/>
  </asset>
  <worldbody>
    <light pos="0 0 4" dir="0 0 -1" diffuse="1 1 1"/>
    <geom name="floor" type="plane" size="5 5 0.1" material="ground_mat"/>
    <body name="torso" pos="0 0 0.5">
      <joint name="root_x" type="slide" axis="1 0 0"/>
      <joint name="root_z" type="slide" axis="0 0 1"/>
      <geom name="torso_geom" type="box" size="0.2 0.15 0.25" material="body_mat" mass="5"/>
      <body name="left_thigh" pos="-0.1 0 -0.25">
        <joint name="left_hip" type="hinge" axis="0 1 0" range="-60 60"/>
        <geom name="left_thigh_geom" type="capsule" fromto="0 0 0 0 0 -0.3" size="0.05" material="body_mat" mass="1.5"/>
        <body name="left_shin" pos="0 0 -0.3">
          <joint name="left_knee" type="hinge" axis="0 1 0" range="0 120"/>
          <geom name="left_shin_geom" type="capsule" fromto="0 0 0 0 0 -0.25" size="0.04" material="body_mat" mass="1"/>
        </body>
      </body>
      <body name="right_thigh" pos="0.1 0 -0.25">
        <joint name="right_hip" type="hinge" axis="0 1 0" range="-60 60"/>
        <geom name="right_thigh_geom" type="capsule" fromto="0 0 0 0 0 -0.3" size="0.05" material="body_mat" mass="1.5"/>
        <body name="right_shin" pos="0 0 -0.3">
          <joint name="right_knee" type="hinge" axis="0 1 0" range="0 120"/>
          <geom name="right_shin_geom" type="capsule" fromto="0 0 0 0 0 -0.25" size="0.04" material="body_mat" mass="1"/>
        </body>
      </body>
    </body>
  </worldbody>
  <actuator>
    <motor name="left_hip_act"   joint="left_hip"   gear="100"/>
    <motor name="left_knee_act"  joint="left_knee"  gear="80"/>
    <motor name="right_hip_act"  joint="right_hip"  gear="100"/>
    <motor name="right_knee_act" joint="right_knee" gear="80"/>
  </actuator>
</mujoco>`;

export const SNIPPETS = [
  {
    name: "6-DOF Arm",
    icon: "🦾",
    xml: `<body name="shoulder" pos="0 0 1.0">
  <joint name="sh_pan"  type="hinge" axis="0 0 1" range="-180 180"/>
  <geom type="cylinder" size="0.05 0.08" material="body_mat" mass="1"/>
  <body name="upper_arm" pos="0 0 0.08">
    <joint name="sh_lift" type="hinge" axis="0 1 0" range="-90 90"/>
    <geom type="capsule" fromto="0 0 0 0 0 0.3" size="0.04" material="body_mat" mass="0.8"/>
    <body name="forearm" pos="0 0 0.3">
      <joint name="elbow" type="hinge" axis="0 1 0" range="-120 0"/>
      <geom type="capsule" fromto="0 0 0 0 0 0.25" size="0.035" material="body_mat" mass="0.6"/>
      <body name="wrist1" pos="0 0 0.25">
        <joint name="wrist_roll"  type="hinge" axis="0 0 1" range="-180 180"/>
        <joint name="wrist_pitch" type="hinge" axis="0 1 0" range="-90 90"/>
        <joint name="wrist_yaw"   type="hinge" axis="1 0 0" range="-90 90"/>
        <geom type="sphere" size="0.04" material="joint_mat" mass="0.3"/>
      </body>
    </body>
  </body>
</body>`,
  },
  {
    name: "Gripper",
    icon: "✊",
    xml: `<body name="gripper_base" pos="0 0 0">
  <geom type="box" size="0.04 0.04 0.02" material="body_mat" mass="0.2"/>
  <body name="finger_left" pos="-0.03 0 0.02">
    <joint name="finger_left_j" type="slide" axis="1 0 0" range="0 0.04"/>
    <geom type="box" size="0.01 0.012 0.05" material="joint_mat" mass="0.05"/>
  </body>
  <body name="finger_right" pos="0.03 0 0.02">
    <joint name="finger_right_j" type="slide" axis="-1 0 0" range="0 0.04"/>
    <geom type="box" size="0.01 0.012 0.05" material="joint_mat" mass="0.05"/>
  </body>
</body>`,
  },
  {
    name: "Wheeled Base",
    icon: "🛞",
    xml: `<body name="base" pos="0 0 0.1">
  <joint name="base_x" type="slide" axis="1 0 0"/>
  <joint name="base_y" type="slide" axis="0 1 0"/>
  <joint name="base_yaw" type="hinge" axis="0 0 1"/>
  <geom type="box" size="0.2 0.15 0.05" material="body_mat" mass="3"/>
  <body name="wheel_fl" pos="-0.18 0.13 -0.05">
    <joint name="wfl" type="hinge" axis="0 1 0"/>
    <geom type="cylinder" size="0.06 0.02" material="joint_mat" mass="0.3"/>
  </body>
  <body name="wheel_fr" pos="0.18 0.13 -0.05">
    <joint name="wfr" type="hinge" axis="0 1 0"/>
    <geom type="cylinder" size="0.06 0.02" material="joint_mat" mass="0.3"/>
  </body>
</body>`,
  },
  {
    name: "IMU Sensors",
    icon: "📡",
    xml: `<!-- Add to <sensor> block -->
<accelerometer name="imu_acc"  site="imu_site"/>
<gyro          name="imu_gyro" site="imu_site"/>
<!-- Add to a body: <site name="imu_site" pos="0 0 0"/> -->`,
  },
  {
    name: "Cameras",
    icon: "📷",
    xml: `<camera name="front_cam" pos="0 -1.5 1.0" xyaxes="1 0 0 0 0.5 1"/>
<camera name="top_cam"   pos="0 0 3.0"  xyaxes="1 0 0 0 1 0"/>`,
  },
];

export const BUILTIN_MACROS = [
  {
    name: "Standard Sensors",
    icon: "📡",
    prompt: "Add a complete sensor suite: joint position sensors for all joints, joint velocity sensors for all joints, and an accelerometer on the torso.",
  },
  {
    name: "Mirror Left→Right",
    icon: "🔄",
    prompt: "Mirror all left-side bodies, joints and actuators to create identical right-side counterparts. Ensure symmetric naming (replace 'left' with 'right').",
  },
  {
    name: "Add Damping",
    icon: "🔧",
    prompt: "Add appropriate damping to all hinge joints to prevent oscillation. Use damping=1.0 for large joints and damping=0.5 for small joints.",
  },
  {
    name: "Colorize by Type",
    icon: "🎨",
    prompt: "Set distinct rgba colors: blue (0.3 0.6 0.9 1) for torso/base bodies, orange (0.9 0.5 0.2 1) for limb segments, green (0.3 0.8 0.4 1) for end-effectors.",
  },
  {
    name: "Add Limits",
    icon: "🔒",
    prompt: "Add realistic joint range limits to all hinge joints that are missing them. Use anatomically plausible ranges.",
  },
  {
    name: "Fix Actuators",
    icon: "⚡",
    prompt: "Add motor actuators for every hinge and slide joint that currently lacks an actuator. Use gear=100 for large joints, gear=50 for small ones.",
  },
];

export function generatePythonScript(xml) {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const modelName = doc.documentElement?.getAttribute("model") || "robot";
  const joints = [...doc.querySelectorAll("joint")]
    .map((joint) => joint.getAttribute("name"))
    .filter(Boolean);
  const actuators = [...doc.querySelectorAll("actuator > *")]
    .map((actuator) => actuator.getAttribute("name"))
    .filter(Boolean);

  return `"""
MuJoCo simulation script for: ${modelName}
Generated by mujoco-copilot
"""
import mujoco
import mujoco.viewer
import numpy as np
import time

# ── Load model ────────────────────────────────────────────────────────────────
XML = """
${xml.replace(/`/g, "'")}
"""

model = mujoco.MjModel.from_xml_string(XML)
data  = mujoco.MjData(model)

# ── Model info ────────────────────────────────────────────────────────────────
print(f"Model: ${modelName}")
print(f"  Bodies:    {model.nbody}")
print(f"  Joints:    {model.njnt}")
print(f"  Actuators: {model.nu}")
print(f"  DOF:       {model.nv}")

# ── Joint name → index helpers ────────────────────────────────────────────────
def joint_id(name):
    return mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_JOINT, name)

def actuator_id(name):
    return mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_ACTUATOR, name)

${joints.length > 0 ? `# Joint indices
${joints.map((joint) => `jid_${joint.replace(/[^a-zA-Z0-9_]/g, "_")} = joint_id("${joint}")`).join("\n")}` : "# No named joints found"}

${actuators.length > 0 ? `# Actuator indices
${actuators.map((actuator) => `aid_${actuator.replace(/[^a-zA-Z0-9_]/g, "_")} = actuator_id("${actuator}")`).join("\n")}` : "# No actuators found"}

# ── Simulation loop ───────────────────────────────────────────────────────────
def controller(model, data):
    """Apply control signals here."""
    t = data.time
${actuators.length > 0
  ? actuators.map((actuator) => `    data.ctrl[aid_${actuator.replace(/[^a-zA-Z0-9_]/g, "_")}] = 0.0  # TODO: set control for ${actuator}`).join("\n")
  : "    pass  # No actuators"}

def run_headless(duration=5.0, dt=None):
    """Run simulation without viewer."""
    mujoco.mj_resetData(model, data)
    dt = dt or model.opt.timestep
    steps = int(duration / dt)
    print(f"\\nRunning {duration}s headless simulation ({steps} steps)...")
    t0 = time.time()
    for i in range(steps):
        controller(model, data)
        mujoco.mj_step(model, data)
        if i % 1000 == 0:
            print(f"  t={data.time:.2f}s  qpos={np.round(data.qpos[:4],3)}")
    wall = time.time() - t0
    print(f"Done. Wall time: {wall:.2f}s  ({steps/wall:.0f} steps/sec)")

def run_viewer():
    """Run simulation with interactive viewer."""
    print("\\nLaunching viewer (close window to exit)...")
    with mujoco.viewer.launch_passive(model, data) as v:
        mujoco.mj_resetData(model, data)
        while v.is_running():
            controller(model, data)
            mujoco.mj_step(model, data)
            v.sync()

if __name__ == "__main__":
    import sys
    if "--viewer" in sys.argv:
        run_viewer()
    else:
        run_headless(duration=5.0)
        print("\\nTip: run with --viewer for interactive simulation")
`;
}

export function loadStoredConfig() {
  const active = localStorage.getItem("mujoco_provider") || "ollama";
  const cfg = { active };

  Object.keys(PROVIDERS).forEach((provider) => {
    const key = localStorage.getItem(`mujoco_key_${provider}`) || "";
    const model =
      localStorage.getItem(`mujoco_model_${provider}`) ||
      (provider === active ? localStorage.getItem("mujoco_model") : "") ||
      PROVIDERS[provider].defaultModel;

    cfg[provider] = { apiKey: key, model };

    if (provider === "ollama") {
      const timeout = Number(localStorage.getItem("mujoco_ollama_timeout_seconds"));
      const numPredict = Number(localStorage.getItem("mujoco_ollama_num_predict"));

      cfg[provider].ollamaTimeoutSeconds = Number.isFinite(timeout) && timeout > 0
        ? timeout
        : PROVIDERS.ollama.defaultTimeoutSeconds;
      cfg[provider].ollamaNumPredict = Number.isFinite(numPredict) && numPredict > 0
        ? numPredict
        : PROVIDERS.ollama.defaultNumPredict;
    }
  });

  return cfg;
}
