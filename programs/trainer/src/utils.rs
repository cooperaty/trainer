// Function to retrieve a max of 32 bytes from a string
// Used to generate a PDA
pub fn text_seed(text: &str, leftover: bool) -> &[u8] {
  let b = text.as_bytes();
  if b.len() > 32 {
    if leftover {
      if b.len() > 64 {
        &b[32..64]
      } else {
        &b[32..]
      }
    } else {
      &b[0..32]
    }
  } else {
    b
  }
}
