const { google } = require('googleapis');

class YouTubeService {
  constructor() {
    this.youtube = google.youtube({
      version: 'v3',
      auth: process.env.YOUTUBE_API_KEY
    });
  }

  async searchVideos(query, maxResults = 10) {
    try {
      const searchResponse = await this.youtube.search.list({
        part: 'id,snippet',
        q: query,
        type: 'video',
        maxResults: maxResults,
        order: 'relevance',
        safeSearch: 'moderate'
      });

      const videoIds = searchResponse.data.items.map(item => item.id.videoId);

      // Get video statistics for view counts
      const statsResponse = await this.youtube.videos.list({
        part: 'statistics,contentDetails',
        id: videoIds.join(',')
      });

      // Combine search results with statistics
      const videos = searchResponse.data.items.map((item, index) => {
        const stats = statsResponse.data.items[index];
        return {
          title: item.snippet.title,
          videoId: item.id.videoId,
          thumbnail: item.snippet.thumbnails.medium.url,
          channelTitle: item.snippet.channelTitle,
          publishedAt: item.snippet.publishedAt,
          description: item.snippet.description,
          views: parseInt(stats?.statistics?.viewCount || 0),
          likes: parseInt(stats?.statistics?.likeCount || 0),
          duration: this.parseDuration(stats?.contentDetails?.duration || 'PT0S')
        };
      });

      // Sort by view count (descending)
      return videos.sort((a, b) => b.views - a.views);

    } catch (error) {
      console.error('YouTube API Error:', error);
      throw new Error('Failed to search YouTube videos');
    }
  }

  async getRelatedVideos(keyTopics) {
    try {
      const allVideos = [];

      // Search for videos related to each key topic
      for (const topic of keyTopics.slice(0, 3)) { // Limit to top 3 topics
        const videos = await this.searchVideos(`${topic} tutorial explanation`, 5);
        allVideos.push(...videos);
      }

      // Remove duplicates and sort by views
      const uniqueVideos = this.removeDuplicates(allVideos);
      return uniqueVideos.sort((a, b) => b.views - a.views).slice(0, 12);

    } catch (error) {
      console.error('Error getting related videos:', error);
      return []; // Return empty array on error
    }
  }

  async searchEducationalVideos(searchTerm) {
    try {
      const educationalKeywords = [
        `${searchTerm} explained`,
        `${searchTerm} tutorial`,
        `${searchTerm} lesson`,
        `${searchTerm} crash course`,
        `learn ${searchTerm}`
      ];

      const allVideos = [];

      for (const keyword of educationalKeywords) {
        const videos = await this.searchVideos(keyword, 3);
        allVideos.push(...videos);
      }

      // Filter for educational content
      const educationalVideos = allVideos.filter(video => {
        const title = video.title.toLowerCase();
        const channel = video.channelTitle.toLowerCase();

        // Prioritize educational channels and content
        const educationalIndicators = [
          'explained', 'tutorial', 'lesson', 'course', 'learn',
          'education', 'academy', 'university', 'school',
          'crash course', 'khan academy', 'ted-ed', 'mit'
        ];

        return educationalIndicators.some(indicator =>
          title.includes(indicator) || channel.includes(indicator)
        );
      });

      const uniqueVideos = this.removeDuplicates(educationalVideos);
      return uniqueVideos.sort((a, b) => b.views - a.views).slice(0, 10);

    } catch (error) {
      console.error('Error searching educational videos:', error);
      return [];
    }
  }

  removeDuplicates(videos) {
    const seen = new Set();
    return videos.filter(video => {
      if (seen.has(video.videoId)) {
        return false;
      }
      seen.add(video.videoId);
      return true;
    });
  }

  parseDuration(duration) {
    // Parse ISO 8601 duration format (PT1M30S)
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return '0:00';

    const hours = parseInt(match[1] || 0);
    const minutes = parseInt(match[2] || 0);
    const seconds = parseInt(match[3] || 0);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  }

  formatViewCount(views) {
    if (views >= 1000000) {
      return (views / 1000000).toFixed(1) + 'M';
    } else if (views >= 1000) {
      return (views / 1000).toFixed(1) + 'K';
    } else {
      return views.toString();
    }
  }

  async getTrendingEducationalVideos() {
    try {
      const response = await this.youtube.videos.list({
        part: 'id,snippet,statistics',
        chart: 'mostPopular',
        regionCode: 'US',
        videoCategoryId: '27', // Education category
        maxResults: 10
      });

      return response.data.items.map(item => ({
        title: item.snippet.title,
        videoId: item.id,
        thumbnail: item.snippet.thumbnails.medium.url,
        channelTitle: item.snippet.channelTitle,
        views: parseInt(item.statistics.viewCount || 0),
        likes: parseInt(item.statistics.likeCount || 0)
      }));
    } catch (error) {
      console.error('Error getting trending videos:', error);
      return [];
    }
  }
}

module.exports = new YouTubeService();