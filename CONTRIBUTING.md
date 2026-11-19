# Contributing to Art Practice Reference Studio

Thank you for your interest in improving Art Practice Reference Studio! We welcome community contributions aimed at fixing bugs, improving performance, and refining the core learning features for artists.

---

## Scope of Contributions

1. **Bug Reports & Fixes**:
   - Observations on rendering glitches, memory leaks, high idle usage, or timer issues.
   - Platform-specific fixes for macOS, Windows, or Linux.
2. **Core Learning Features**:
   - Enhancements to the spaced repetition (SM-2) scheduling calculations.
   - Refinements to observational tools (Plumb line, Notan, Squint, Value maps, Color palette).
   - Improvements to the local Reference Board and gesture session flows.
3. **Pro Add-ons & Commercial Features**:
   - Commercial Pro add-ons live in a separate, private repository and are not hosted or accepted directly into this repository.
   - If you are building an extension, please use the documented frontend and backend extension hooks (`userdata/extensions/`).

---

## Development Setup

1. **Prerequisites**: Node.js (v18 or higher recommended).
2. **Installation**:
   ```bash
   npm install
   ```
3. **Run in Browser Mode**:
   ```bash
   npm start
   ```
   Open `http://localhost:50860` in any modern browser.
4. **Run in Desktop Electron Mode**:
   ```bash
   npm run electron
   ```
5. **Run the Test Suite**:
   ```bash
   npm test
   ```
   All tests must pass before opening a Pull Request.

---

## Contributor License Agreement (CLA)

By submitting a pull request, patch, code snippet, or documentation to this repository, you agree to the following terms:

1. **Grant of Rights**: You grant codemolde ("Maintainer") a perpetual, worldwide, non-exclusive, royalty-free, irrevocable copyright license to reproduce, prepare derivative works of, publicly display, sublicense, and distribute your contributions and such derivative works.
2. **Commercial & Dual-Distribution Authorization**: You acknowledge and agree that your contributions may be included in both:
   - The source-available software distributed in this repository under the PolyForm Shield License 1.0.0.
   - Commercial Pro editions, packages, or proprietary extension distributions maintained separately.
3. **Original Author Warranty**: You represent that each of your contributions is your original creation, and that you have the full legal right to grant the rights described above without violating any third-party copyright, patent, trademark, or license obligations.
4. **No Employment Relationship**: Submitting a contribution does not create any employment, agency, or partnership relationship with the Maintainer.
