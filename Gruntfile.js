module.exports = function(grunt) {
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        jsdoc : {
            // jsdoc: './node_modules/.bin/jsdoc',
            dist : {
                src: ['TileCache.js'], 
                options: {
                    destination: 'doc',
                    configure: './node_modules/ink-docstrap/template/jsdoc.conf.json',
                    template : './node_modules/ink-docstrap/template',
                    private: false
                }
            }
        }
    });

    // grunt.loadNpmTasks('grunt-contrib-uglify');
    // grunt.loadNpmTasks('grunt-contrib-jshint');
    // grunt.loadNpmTasks('grunt-contrib-qunit');
    // grunt.loadNpmTasks('grunt-contrib-watch');
    // grunt.loadNpmTasks('grunt-contrib-concat');

    // grunt.registerTask('test', ['jshint', 'qunit']);

    grunt.loadNpmTasks('grunt-jsdoc');
    grunt.registerTask('default', ['jsdoc']);
}