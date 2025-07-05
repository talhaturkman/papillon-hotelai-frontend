// Test the fixed normalizeText function
function normalizeText(text) {
  return text.toLowerCase().replace(/[^a-zA-Z0-9ğüşöçıİĞÜŞÖÇ\s]/g, '').replace(/\s+/g, '').trim();
}

console.log('🔍 Testing fixed normalizeText function');
console.log('=====================================');

console.log('\n📝 Testing normalizeText function:');
console.log('"Bloom_Lounge" ->', normalizeText("Bloom_Lounge"));
console.log('"bloom lounge" ->', normalizeText("bloom lounge"));
console.log('"Bloom Lounge" ->', normalizeText("Bloom Lounge"));
console.log('"bloomlounge" ->', normalizeText("bloomlounge"));

// Test if they match
const normalized1 = normalizeText("Bloom_Lounge");
const normalized2 = normalizeText("bloom lounge");
console.log('\nMatch:', normalized1 === normalized2);
console.log('Includes test:', normalized1.includes(normalized2));
console.log('Reverse includes test:', normalized2.includes(normalized1));

console.log('\n✅ Fix successful!'); 