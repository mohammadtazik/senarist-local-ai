
import 'dotenv/config';

import { pool } from '../config/database.js';
import { userRepository } from '../repositories/user.repository.js';
import { categoryRepository } from '../repositories/category.repository.js';

async function main() {
  try {
    const testUser = await userRepository.findByEmail(
      'repository-check@example.invalid'
    );

    const categories = await categoryRepository.findAll();

    console.log('Repository test completed:');
    console.log({
      database: 'connected',
      userRepository: 'working',
      categoryRepository: 'working',
      testUserFound: testUser !== null,
      activeCategoriesCount: categories.length,
    });
  } catch (error) {
    console.error('Repository test failed:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void main();
