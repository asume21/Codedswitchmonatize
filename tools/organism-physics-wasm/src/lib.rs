use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};

#[wasm_bindgen]
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PhysicsState {
    pub bounce: f32,
    pub swing: f32,
    pub pocket: f32,
    pub presence: f32,
    pub density: f32,
    pub pulse: f32,
    pub energy: f32,
}

#[wasm_bindgen]
pub struct OrganismPhysicsEngine {
    state: PhysicsState,
}

#[wasm_bindgen]
impl OrganismPhysicsEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> OrganismPhysicsEngine {
        OrganismPhysicsEngine {
            state: PhysicsState {
                bounce: 0.5,
                swing: 0.1,
                pocket: 0.5,
                presence: 0.3,
                density: 0.4,
                pulse: 90.0,
                energy: 0.3,
            },
        }
    }

    pub fn update(&mut self, audio_rms: f32, audio_pitch: f32) -> JsValue {
        // Rust's integrity: No-jitter calculations
        // Subtle emotional evolution logic
        self.state.presence = (self.state.presence * 0.9 + audio_rms * 0.1).clamp(0.0, 1.0);
        self.state.energy = (self.state.energy * 0.95 + self.state.presence * 0.05).clamp(0.0, 1.0);
        
        // Pocket logic: higher energy = tighter pocket, lower energy = more swing
        self.state.pocket = (0.5 + self.state.energy * 0.3).clamp(0.0, 1.0);
        self.state.swing = (0.3 - self.state.energy * 0.2).clamp(0.0, 1.0);

        serde_wasm_bindgen::to_value(&self.state).unwrap()
    }

    pub fn get_state(&self) -> JsValue {
        serde_wasm_bindgen::to_value(&self.state).unwrap()
    }
}
