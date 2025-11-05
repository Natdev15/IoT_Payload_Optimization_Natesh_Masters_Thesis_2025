# Investigating Efficient Binary Serialization Protocols for Hybrid TN/NT Networks for Massive IoT Devices and M2M Systems – Master’s Thesis (2025)

**University of Pisa – Master of Science in Computer Science & Networking**

**Supervisor:** Prof. Paolo Pagano  
**Co-Supervisor:** Senior Researcher Mariano Falcitelli  
**Author:** Natesh Kumar (Natdev15)

---

### Project Overview
This repository contains the complete implementation and evaluation of **binary serialization protocols for IoT payload optimization** in TN/NTN communication environments.  
The work was developed as part of the Master’s Thesis at the University of Pisa and validated using the **Astrocast LEO DevKit** and **Mobius (oneM2M)** middleware.

The project includes **four independent implementations**:

1. **CBOR Service** – Compression/decompression implementation for CBOR  
2. **MessagePack Service** – Compression/decompression implementation for MessagePack  
3. **Struct + Zlib Service** – Compression/decompression implementation using Struct and Zlib  
4. **Protobuf Service** – Complete implementation including Astrocast script, decoder, and web dashboard for visualization  

---

### Technologies & Tools
Python • C++ • Node.js • Docker • Zlib • Protobuf • MessagePack • CBOR • oneM2M • Mobius • Astrocast DevKit • Locust • HTML/CSS/JS  

---

### Results
- Achieved up to **3× payload size reduction** compared to JSON  
- Implemented a **Figure of Merit (FoM)** metric combining payload size, transmission time, and success rate  
- Successfully demonstrated **real data transmission** over the Astrocast LEO satellite network  

---

### Repository Structure
```
IoT_Payload_Optimization_Natesh_Masters_Thesis_2025/
├── CBOR_Service/
├── MessagePack_Service/
├── Struct_Zlib_Service/
├── Protobuf_Service_with_Dashboard/
├── LICENSE
└── README.md
```


---

### Citation
> Natesh Kumar (2025). *Investigating Efficient Binary Serialization Protocols for Hybrid TN/NT Networks for Massive IoT Devices and M2M Systems.*  
> Master’s Thesis, Computer Science & Networking, University of Pisa.

---

© 2025 **Natesh Kumar (Natdev15)**  
All rights reserved.  
This project is shared for **academic and research reference** under the supervision of Prof. Paolo Pagano and Senior Researcher Mariano Falcitelli.  
See [LICENSE](./LICENSE) for usage terms.
