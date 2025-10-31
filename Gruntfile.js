module.exports = function(grunt) {
    // Project configuration
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        
        // Concatenate JavaScript files
        concat: {
            options: {
                separator: ';\n',
                banner: '/*! <%= pkg.name %> - v<%= pkg.version %> - ' +
                    '<%= grunt.template.today("yyyy-mm-dd") %> */\n'
            },
            dist: {
            src: [
                'scripts/utils.js',
                'scripts/api.js', 
                'scripts/dom.js',
                'scripts/complete-chat.js',
                'scripts/main.js'
            ],
                dest: 'scripts/writeassistdev.min.js'
            }
        },
        
        // Minify JavaScript
        uglify: {
            options: {
                banner: '/*! <%= pkg.name %> - v<%= pkg.version %> - ' +
                    '<%= grunt.template.today("yyyy-mm-dd") %> */\n',
                mangle: false, // Don't mangle variable names for debugging
                compress: {
                    drop_console: false // Keep console.log for debugging
                }
            },
            dist: {
                files: {
                    'scripts/writeassistdev.min.js': ['scripts/writeassistdev.min.js']
                }
            }
        },
        
        // Watch for changes
        watch: {
            scripts: {
                files: ['scripts/*.js'],
                tasks: ['concat', 'uglify'],
                options: {
                    spawn: false
                }
            }
        }
    });
    
    // Load plugins
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-watch');
    
    // Default task
    grunt.registerTask('default', ['concat', 'uglify']);
    grunt.registerTask('build', ['concat', 'uglify']);
    grunt.registerTask('dev', ['concat']); // Development build without minification
};
