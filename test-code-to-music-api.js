/**
 * Test the Code-to-Music API endpoint
 */

const sampleCode = `
class MusicPlayer {
    constructor() {
        this.volume = 50;
        this.isPlaying = false;
    }
    
    play(song) {
        for (let i = 0; i < song.length; i++) {
            if (song[i].isValid()) {
                this.isPlaying = true;
                return true;
            }
        }
        return false;
    }
    
    stop() {
        this.isPlaying = false;
    }
}
`;

async function testCodeToMusic() {
    console.log('🎵 Testing Code-to-Music API...\n');
    
    const testCases = [
        { language: 'javascript', genre: 'pop', variation: 0 },
        { language: 'javascript', genre: 'rock', variation: 0 },
        { language: 'javascript', genre: 'hiphop', variation: 5 },
    ];
    
    for (const testCase of testCases) {
        console.log(`\n📝 Test: ${testCase.genre} (variation ${testCase.variation})`);
        console.log('─'.repeat(60));
        
        try {
            const response = await fetch('http://localhost:4000/api/code-to-music', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    code: sampleCode,
                    language: testCase.language,
                    genre: testCase.genre,
                    variation: testCase.variation,
                }),
            });
            
            const text = await response.text();
            console.log(`   Response status: ${response.status}`);
            
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                console.log(`   Raw response: ${text.substring(0, 200)}`);
                throw new Error('Invalid JSON response');
            }
            
            console.log(`   Has success field: ${Object.prototype.hasOwnProperty.call(data, 'success')}`);
            console.log(`   Data keys: ${Object.keys(data).join(', ')}`);
            
            if (data.success) {
                console.log('✅ SUCCESS');
                console.log(`   Genre: ${data.metadata?.genre}`);
                console.log(`   BPM: ${data.metadata?.bpm}`);
                console.log(`   Key: ${data.metadata?.key}`);
                console.log(`   Duration: ${data.metadata?.duration?.toFixed(1)}s`);
                console.log(`   Timeline Events: ${data.music?.timeline?.length || 0}`);
                console.log(`   Chords: ${data.music?.chords?.length || 0}`);
                console.log(`   Melody Notes: ${data.music?.melody?.length || 0}`);
                console.log(`   Drum Pattern: ${data.music?.drums ? 'Yes' : 'No'}`);
                
                // Check reproducibility
                if (testCase.variation === 0) {
                    console.log(`   Seed: ${data.metadata?.seed}`);
                }
            } else if (data.success === false) {
                console.log('❌ FAILED');
                console.log(`   Error: ${data.error}`);
            } else {
                console.log('⚠️  UNEXPECTED RESPONSE');
                console.log(`   Data: ${JSON.stringify(data).substring(0, 300)}`);
            }
        } catch (error) {
            console.log('❌ REQUEST FAILED');
            console.log(`   Error: ${error.message}`);
        }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ API Testing Complete!');
}

// Run the test
testCodeToMusic().catch(console.error);
